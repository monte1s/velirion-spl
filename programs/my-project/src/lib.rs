use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("ENppTkN4QxFG6fepC7cbWZcM6zsEAw7KXSQ9Qy6yC1vq");

pub const NUM_PHASES: usize = 10;

#[program]
pub mod my_project {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        total_for_sale: u64,
        base_price_quote_per_token: u64,
        price_increment_per_phase_quote: u64,
        per_phase_allocation: u64,
        eth_enabled: bool,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.owner = *ctx.accounts.owner.key;
        state.token_mint = *ctx.accounts.token_mint.to_account_info().key;
        state.funds_recipient = *ctx.accounts.funds_recipient.key;
        state.sale_start = Clock::get()?.unix_timestamp as u64;
        state.sale_end_initial = state.sale_start + 90 * 24 * 60 * 60; // 90 days
        state.sale_end = state.sale_end_initial;
        state.extended = false;
        state.total_for_sale = total_for_sale;
        state.eth_enabled = eth_enabled;

        let per_phase = if per_phase_allocation == 0 {
            total_for_sale / NUM_PHASES as u64
        } else {
            per_phase_allocation
        };

        for i in 0..NUM_PHASES {
            state.phases[i].price_quote_per_token = base_price_quote_per_token
                .checked_add(price_increment_per_phase_quote.checked_mul(i as u64).unwrap())
                .unwrap();
            state.phases[i].allocation = per_phase;
            state.phases[i].sold = 0;
        }

        Ok(())
    }

    pub fn extend_once(ctx: Context<OnlyOwner>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require!(!state.extended, PresaleError::AlreadyExtended);
        state.extended = true;
        state.sale_end = state.sale_end.checked_add(30 * 24 * 60 * 60).unwrap();
        Ok(())
    }

    pub fn deposit_tokens(ctx: Context<DepositTokens>, amount: u64) -> Result<()> {
        // transfer token from owner to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;
        Ok(())
    }

    pub fn buy_with_quote(
        ctx: Context<BuyWithQuote>,
        max_quote_amount: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require!(is_active(state)?, PresaleError::SaleNotActive);
        require!(max_quote_amount > 0, PresaleError::InvalidConfig);

        let mut remaining_quote = max_quote_amount as u128;
        let mut total_tokens_bought: u128 = 0;
        let mut total_quote_cost: u128 = 0;

        // planned per phase
        let mut planned: [u64; NUM_PHASES] = [0u64; NUM_PHASES];

        let start_phase = current_phase_index(&state)?;

        for i in start_phase..NUM_PHASES {
            if remaining_quote == 0 { break; }
            let p = &state.phases[i];
            if p.sold >= p.allocation { continue; }

            let phase_remaining = (p.allocation - p.sold) as u128;
            let tokens_affordable = remaining_quote
                .checked_mul(1_000_000_000_000_000_000u128)
                .unwrap()
                .checked_div(p.price_quote_per_token as u128)
                .unwrap();

            if tokens_affordable == 0 { break; }

            let mut tokens_to_buy = if tokens_affordable < phase_remaining { tokens_affordable } else { phase_remaining };

            let sold_before = total_sold(&state) as u128;
            if sold_before + total_tokens_bought + tokens_to_buy > state.total_for_sale as u128 {
                tokens_to_buy = state.total_for_sale as u128 - sold_before - total_tokens_bought;
            }

            if tokens_to_buy == 0 { break; }

            let cost = tokens_to_buy
                .checked_mul(p.price_quote_per_token as u128)
                .unwrap()
                .checked_div(1_000_000_000_000_000_000u128)
                .unwrap();

            planned[i] = tokens_to_buy as u64;
            total_tokens_bought = total_tokens_bought.checked_add(tokens_to_buy).unwrap();
            total_quote_cost = total_quote_cost.checked_add(cost).unwrap();
            remaining_quote = remaining_quote.checked_sub(cost).unwrap();

            if (total_sold(&state) as u128) + total_tokens_bought >= state.total_for_sale as u128 { break; }
        }

        require!(total_tokens_bought > 0, PresaleError::InsufficientFunds);

        // Transfer quote tokens from buyer to funds_recipient
        // buyer -> funds_recipient
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_quote.to_account_info(),
            to: ctx.accounts.recipient_quote.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), total_quote_cost as u64)?;

            // finalize phases
        for i in 0..NUM_PHASES {
            let t = planned[i] as u64;
            if t > 0 {
                state.phases[i].sold = state.phases[i].sold.checked_add(t).unwrap();
            }
        }

            // NOTE: transferring tokens from the vault to the buyer requires the vault's authority
            // (typically a PDA) to sign the transfer. That logic (PDA derivation and signed CPI)
            // should be implemented when integrating with a real vault authority. For now, this
            // instruction updates sale accounting only. Tokens must be moved out-of-band by the owner/PDA.

        Ok(())
    }

    pub fn withdraw_unsold(ctx: Context<WithdrawUnsold>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        let now = Clock::get()?.unix_timestamp as u64;
        require!(now > state.sale_end, PresaleError::SaleNotActive);

        let bal = ctx.accounts.vault.amount;
        require!(bal > 0, PresaleError::NothingToWithdraw);

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts), bal)?;

        Ok(())
    }
}

// -------------------- Accounts and State --------------------

#[derive(AnchorSerialize, AnchorDeserialize, Default, Clone)]
pub struct Phase {
    pub price_quote_per_token: u64,
    pub allocation: u64,
    pub sold: u64,
}

#[account]
pub struct State {
    pub owner: Pubkey,
    pub token_mint: Pubkey,
    pub funds_recipient: Pubkey,
    pub sale_start: u64,
    pub sale_end_initial: u64,
    pub sale_end: u64,
    pub extended: bool,
    pub total_for_sale: u64,
    pub phases: [Phase; NUM_PHASES],
    pub eth_enabled: bool,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: token mint
    pub token_mint: UncheckedAccount<'info>,
    /// CHECK: recipient can be any account
    pub funds_recipient: UncheckedAccount<'info>,
    #[account(init, payer = owner, space = 8 + 1024, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OnlyOwner<'info> {
    #[account(mut, has_one = owner)]
    pub state: Account<'info, State>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositTokens<'info> {
    #[account(mut, has_one = owner)]
    pub state: Account<'info, State>,
    pub owner: Signer<'info>,
    /// CHECK: token account
    #[account(mut)]
    pub from: UncheckedAccount<'info>,
    /// CHECK: token account
    #[account(mut)]
    pub vault: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyWithQuote<'info> {
    #[account(mut)]
    pub state: Account<'info, State>,
    pub buyer: Signer<'info>,
    /// CHECK: buyer quote token account
    #[account(mut)]
    pub buyer_quote: UncheckedAccount<'info>,
    /// CHECK: recipient quote token account
    #[account(mut)]
    pub recipient_quote: UncheckedAccount<'info>,
    /// CHECK: vault token account
    #[account(mut)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: buyer token account
    #[account(mut)]
    pub buyer_token: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: quote mint
    pub quote_mint: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct WithdrawUnsold<'info> {
    #[account(mut, has_one = owner)]
    pub state: Account<'info, State>,
    pub owner: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// -------------------- Helpers --------------------

fn is_active(state: &State) -> Result<bool> {
    let now = Clock::get()?.unix_timestamp as u64;
    Ok(now >= state.sale_start && now <= state.sale_end && total_sold(state) < state.total_for_sale)
}

fn total_sold(state: &State) -> u64 {
    let mut sold: u64 = 0;
    for i in 0..NUM_PHASES {
        sold = sold.checked_add(state.phases[i].sold).unwrap();
    }
    sold
}

fn current_phase_index(state: &State) -> Result<usize> {
    for i in 0..NUM_PHASES {
        if state.phases[i].sold < state.phases[i].allocation {
            return Ok(i);
        }
    }
    Ok(NUM_PHASES - 1)
}

#[error_code]
pub enum PresaleError {
    #[msg("Sale not active")]
    SaleNotActive,
    #[msg("Zero address")]
    ZeroAddress,
    #[msg("Invalid config")]
    InvalidConfig,
    #[msg("Nothing to withdraw")]
    NothingToWithdraw,
    #[msg("Already extended")]
    AlreadyExtended,
    #[msg("Insufficient funds")]
    InsufficientFunds,
}

