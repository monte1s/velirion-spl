use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use spl_token::instruction as token_instruction;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod velirion_spl {
    use super::*;

    /// Initialize the token with initial supply and ownership controls
    pub fn initialize_token(
        ctx: Context<InitializeToken>,
        name: String,
        symbol: String,
        decimals: u8,
        initial_supply: u64,
    ) -> Result<()> {
        let token_state = &mut ctx.accounts.token_state;
        let mint = &ctx.accounts.mint;
        
        // Initialize token state
        token_state.mint = mint.key();
        token_state.authority = ctx.accounts.authority.key();
        token_state.name = name;
        token_state.symbol = symbol;
        token_state.decimals = decimals;
        token_state.total_supply = initial_supply;
        token_state.circulating_supply = initial_supply;
        token_state.burned_supply = 0;
        token_state.is_initialized = true;
        token_state.bump = ctx.bumps.token_state;

        // Mint initial supply to authority's token account
        let seeds = &[
            b"token_state",
            mint.key().as_ref(),
            &[token_state.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = token_instruction::MintTo {
            mint: mint.to_account_info(),
            to: ctx.accounts.authority_token_account.to_account_info(),
            authority: token_state.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token_instruction::mint_to(cpi_ctx, initial_supply)?;

        emit!(TokenInitialized {
            mint: mint.key(),
            authority: ctx.accounts.authority.key(),
            initial_supply,
        });

        Ok(())
    }

    /// Mint new tokens (only by authority)
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        let token_state = &mut ctx.accounts.token_state;
        
        require!(token_state.is_initialized, ErrorCode::TokenNotInitialized);
        require!(token_state.authority == ctx.accounts.authority.key(), ErrorCode::Unauthorized);

        // Update supply
        token_state.circulating_supply = token_state.circulating_supply
            .checked_add(amount)
            .ok_or(ErrorCode::SupplyOverflow)?;
        
        token_state.total_supply = token_state.total_supply
            .checked_add(amount)
            .ok_or(ErrorCode::SupplyOverflow)?;

        // Mint tokens
        let seeds = &[
            b"token_state",
            token_state.mint.as_ref(),
            &[token_state.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = token_instruction::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.to_token_account.to_account_info(),
            authority: token_state.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token_instruction::mint_to(cpi_ctx, amount)?;

        emit!(TokensMinted {
            mint: ctx.accounts.mint.key(),
            to: ctx.accounts.to_token_account.key(),
            amount,
        });

        Ok(())
    }

    /// Burn tokens and reduce supply
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        let token_state = &mut ctx.accounts.token_state;
        
        require!(token_state.is_initialized, ErrorCode::TokenNotInitialized);
        require!(token_state.authority == ctx.accounts.authority.key(), ErrorCode::Unauthorized);

        // Check if user has enough tokens to burn
        let user_token_account = &ctx.accounts.user_token_account;
        require!(user_token_account.amount >= amount, ErrorCode::InsufficientBalance);

        // Update supply
        token_state.circulating_supply = token_state.circulating_supply
            .checked_sub(amount)
            .ok_or(ErrorCode::SupplyUnderflow)?;
        
        token_state.burned_supply = token_state.burned_supply
            .checked_add(amount)
            .ok_or(ErrorCode::SupplyOverflow)?;

        // Burn tokens
        let seeds = &[
            b"token_state",
            token_state.mint.as_ref(),
            &[token_state.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = token_instruction::Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: user_token_account.to_account_info(),
            authority: token_state.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token_instruction::burn(cpi_ctx, amount)?;

        emit!(TokensBurned {
            mint: ctx.accounts.mint.key(),
            from: user_token_account.key(),
            amount,
        });

        Ok(())
    }

    /// Transfer ownership to a new authority
    pub fn transfer_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        let token_state = &mut ctx.accounts.token_state;
        
        require!(token_state.is_initialized, ErrorCode::TokenNotInitialized);
        require!(token_state.authority == ctx.accounts.authority.key(), ErrorCode::Unauthorized);

        let old_authority = token_state.authority;
        token_state.authority = new_authority;

        emit!(AuthorityTransferred {
            mint: token_state.mint,
            old_authority,
            new_authority,
        });

        Ok(())
    }

    /// Get token state information
    pub fn get_token_state(ctx: Context<GetTokenState>) -> Result<TokenState> {
        let token_state = &ctx.accounts.token_state;
        require!(token_state.is_initialized, ErrorCode::TokenNotInitialized);
        Ok(*token_state)
    }
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, decimals: u8, initial_supply: u64)]
pub struct InitializeToken<'info> {
    #[account(
        init,
        payer = authority,
        space = TokenState::LEN,
        seeds = [b"token_state", mint.key().as_ref()],
        bump
    )]
    pub token_state: Account<'info, TokenState>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = decimals,
        mint::authority = token_state,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = authority,
    )]
    pub authority_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"token_state", mint.key().as_ref()],
        bump = token_state.bump,
    )]
    pub token_state: Account<'info, TokenState>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub to_token_account: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(
        mut,
        seeds = [b"token_state", mint.key().as_ref()],
        bump = token_state.bump,
    )]
    pub token_state: Account<'info, TokenState>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(
        mut,
        seeds = [b"token_state", mint.key().as_ref()],
        bump = token_state.bump,
    )]
    pub token_state: Account<'info, TokenState>,
    
    pub mint: Account<'info, Mint>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetTokenState<'info> {
    #[account(
        seeds = [b"token_state", mint.key().as_ref()],
        bump = token_state.bump,
    )]
    pub token_state: Account<'info, TokenState>,
    
    pub mint: Account<'info, Mint>,
}

#[account]
pub struct TokenState {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: u64,
    pub circulating_supply: u64,
    pub burned_supply: u64,
    pub is_initialized: bool,
    pub bump: u8,
}

impl TokenState {
    pub const LEN: usize = 8 + // discriminator
        32 + // mint
        32 + // authority
        4 + 32 + // name (String)
        4 + 8 + // symbol (String)
        1 + // decimals
        8 + // total_supply
        8 + // circulating_supply
        8 + // burned_supply
        1 + // is_initialized
        1; // bump
}

#[event]
pub struct TokenInitialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub initial_supply: u64,
}

#[event]
pub struct TokensMinted {
    pub mint: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokensBurned {
    pub mint: Pubkey,
    pub from: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AuthorityTransferred {
    pub mint: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Token has not been initialized")]
    TokenNotInitialized,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Supply overflow")]
    SupplyOverflow,
    #[msg("Supply underflow")]
    SupplyUnderflow,
    #[msg("Insufficient balance")]
    InsufficientBalance,
}
