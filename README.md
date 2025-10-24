# Velirion SPL - Token Presale Program

A Solana program built with Anchor framework that implements a sophisticated token presale mechanism with multiple phases, dynamic pricing, and flexible configuration options.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Program Structure](#program-structure)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Security Considerations](#security-considerations)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

Velirion SPL is a comprehensive token presale program that enables project owners to conduct structured token sales with multiple phases, each having different pricing and allocation strategies. The program supports both SOL and custom quote tokens, includes automatic phase progression, and provides flexible sale extension capabilities.

### Key Capabilities

- **Multi-Phase Presale**: 10 configurable phases with different pricing
- **Dynamic Pricing**: Incremental price increases per phase
- **Flexible Allocation**: Configurable tokens per phase
- **Sale Extensions**: One-time extension capability
- **Multi-Token Support**: Works with any SPL token as quote currency
- **Automatic Phase Progression**: Seamless transition between phases
- **Owner Controls**: Comprehensive administrative functions

## ✨ Features

### Core Features
- ✅ **Multi-Phase Architecture**: 10 distinct phases with individual pricing
- ✅ **Dynamic Price Calculation**: Automatic price increments per phase
- ✅ **Flexible Token Allocation**: Configurable tokens per phase
- ✅ **Sale Extension**: One-time 30-day extension capability
- ✅ **Multi-Currency Support**: SOL and custom SPL tokens
- ✅ **Automatic Phase Management**: Smart phase progression logic
- ✅ **Comprehensive Error Handling**: Detailed error codes and messages
- ✅ **Owner Privileges**: Administrative controls for sale management

### Technical Features
- ✅ **Anchor Framework**: Built with Anchor for type safety
- ✅ **SPL Token Integration**: Full SPL token program compatibility
- ✅ **PDA Management**: Secure program-derived addresses
- ✅ **CPI Support**: Cross-program invocation capabilities
- ✅ **Comprehensive Testing**: TypeScript test suite
- ✅ **IDL Generation**: Automatic interface definition

## 🏗️ Architecture

### Program Structure

```
velirion-spl/
├── programs/
│   └── my-project/
│       ├── Cargo.toml          # Rust dependencies
│       └── src/
│           └── lib.rs          # Main program logic
├── tests/
│   └── my-project.ts           # Test suite
├── migrations/
│   └── deploy.ts               # Deployment script
├── Anchor.toml                 # Anchor configuration
├── Cargo.toml                  # Workspace configuration
└── package.json                # Node.js dependencies
```

### State Management

The program maintains a single `State` account that contains:
- **Owner Information**: Program owner and token mint details
- **Sale Configuration**: Start/end times, total allocation
- **Phase Data**: 10 phases with pricing and allocation info
- **Sale Status**: Active/inactive state and extension flags

## 🚀 Installation & Setup

### Prerequisites

- Rust 1.89.0+
- Solana CLI 1.17+
- Anchor Framework 0.32.1+
- Node.js 16+
- Yarn package manager

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd velirion-spl
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Build the program**
   ```bash
   anchor build
   ```

4. **Run tests**
   ```bash
   anchor test
   ```

### Development Environment

```bash
# Start local validator
solana-test-validator

# Deploy to localnet
anchor deploy

# Run tests
anchor test
```

## 📖 Usage

### Program Initialization

```rust
pub fn initialize(
    ctx: Context<Initialize>,
    total_for_sale: u64,
    base_price_quote_per_token: u64,
    price_increment_per_phase_quote: u64,
    per_phase_allocation: u64,
    eth_enabled: bool,
) -> Result<()>
```

**Parameters:**
- `total_for_sale`: Total tokens available for sale
- `base_price_quote_per_token`: Starting price per token
- `price_increment_per_phase_quote`: Price increase per phase
- `per_phase_allocation`: Tokens allocated per phase
- `eth_enabled`: Enable ETH compatibility

### Key Instructions

#### 1. Initialize Presale
```typescript
await program.methods
  .initialize(
    new anchor.BN(1_000_000_000), // total_for_sale
    new anchor.BN(1000),          // base_price
    new anchor.BN(100),           // price_increment
    new anchor.BN(100_000_000),   // per_phase_allocation
    false                         // eth_enabled
  )
  .accounts({
    owner: owner.publicKey,
    tokenMint: tokenMint,
    fundsRecipient: recipient.publicKey,
    state: statePDA,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

#### 2. Deposit Tokens
```typescript
await program.methods
  .depositTokens(new anchor.BN(amount))
  .accounts({
    state: statePDA,
    owner: owner.publicKey,
    from: fromTokenAccount,
    vault: vaultTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

#### 3. Buy Tokens
```typescript
await program.methods
  .buyWithQuote(new anchor.BN(maxQuoteAmount))
  .accounts({
    state: statePDA,
    buyer: buyer.publicKey,
    buyerQuote: buyerQuoteAccount,
    recipientQuote: recipientQuoteAccount,
    vault: vaultTokenAccount,
    buyerToken: buyerTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
    quoteMint: quoteMint,
  })
  .rpc();
```

#### 4. Extend Sale
```typescript
await program.methods
  .extendOnce()
  .accounts({
    state: statePDA,
    owner: owner.publicKey,
  })
  .rpc();
```

## 📚 API Reference

### Instructions

| Instruction | Description | Accounts Required |
|-------------|-------------|-------------------|
| `initialize` | Initialize the presale | owner, token_mint, funds_recipient, state |
| `deposit_tokens` | Deposit tokens to vault | state, owner, from, vault |
| `buy_with_quote` | Purchase tokens with quote currency | state, buyer, buyer_quote, recipient_quote, vault, buyer_token |
| `extend_once` | Extend sale by 30 days | state, owner |
| `withdraw_unsold` | Withdraw unsold tokens | state, owner, vault, to |

### State Structure

```rust
pub struct State {
    pub owner: Pubkey,                    // Program owner
    pub token_mint: Pubkey,              // Token being sold
    pub funds_recipient: Pubkey,         // Quote token recipient
    pub sale_start: u64,                 // Sale start timestamp
    pub sale_end_initial: u64,           // Initial sale end
    pub sale_end: u64,                   // Current sale end
    pub extended: bool,                  // Extension status
    pub total_for_sale: u64,             // Total tokens for sale
    pub phases: [Phase; NUM_PHASES],     // Phase data (10 phases)
    pub eth_enabled: bool,               // ETH compatibility
    pub bump: u8,                        // PDA bump
}
```

### Phase Structure

```rust
pub struct Phase {
    pub price_quote_per_token: u64,     // Price per token
    pub allocation: u64,                 // Tokens allocated
    pub sold: u64,                      // Tokens sold
}
```

### Error Codes

| Error | Code | Description |
|-------|------|-------------|
| `SaleNotActive` | 6000 | Sale is not currently active |
| `ZeroAddress` | 6001 | Invalid zero address |
| `InvalidConfig` | 6002 | Invalid configuration parameters |
| `NothingToWithdraw` | 6003 | No tokens available for withdrawal |
| `AlreadyExtended` | 6004 | Sale has already been extended |
| `InsufficientFunds` | 6005 | Insufficient funds for purchase |

## 🧪 Testing

### Running Tests

```bash
# Run all tests
anchor test

# Run specific test file
yarn test tests/my-project.ts

# Run with verbose output
anchor test --verbose
```

### Test Structure

The test suite includes:
- **Initialization Tests**: Verify proper program setup
- **Token Deposit Tests**: Test token vault functionality
- **Purchase Flow Tests**: Test buying mechanisms
- **Phase Progression Tests**: Verify phase transitions
- **Error Handling Tests**: Test error conditions
- **Extension Tests**: Test sale extension functionality

### Example Test

```typescript
describe("my-project", () => {
  it("Is initialized!", async () => {
    const tx = await program.methods
      .initialize(
        new anchor.BN(1_000_000_000),
        new anchor.BN(1),
        new anchor.BN(0),
        new anchor.BN(0),
        false
      )
      .accounts({
        owner: provider.wallet.publicKey,
        tokenMint: tokenMint.publicKey,
        fundsRecipient: provider.wallet.publicKey,
        state: statePDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("init tx", tx);
  });
});
```

## 🚀 Deployment

### Local Development

```bash
# Start local validator
solana-test-validator

# Deploy to localnet
anchor deploy

# Verify deployment
solana program show <program-id>
```

### Devnet Deployment

```bash
# Configure for devnet
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show <program-id> --url devnet
```

### Mainnet Deployment

```bash
# Build for mainnet
anchor build --release

# Deploy to mainnet
anchor deploy --provider.cluster mainnet

# Verify deployment
solana program show <program-id> --url mainnet
```

## ⚙️ Configuration

### Anchor.toml

```toml
[programs.localnet]
my_project = "ENppTkN4QxFG6fepC7cbWZcM6zsEAw7KXSQ9Qy6yC1vq"

[programs.devnet]
my_project = "ENppTkN4QxFG6fepC7cbWZcM6zsEAw7KXSQ9Qy6yC1vq"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 \"tests/**/*.ts\""
```

### Program Configuration

- **Program ID**: `ENppTkN4QxFG6fepC7cbWZcM6zsEAw7KXSQ9Qy6yC1vq`
- **Number of Phases**: 10
- **Default Sale Duration**: 90 days
- **Extension Duration**: 30 days
- **State Account Size**: 1024 bytes

## 🔒 Security Considerations

### Access Control
- **Owner-Only Functions**: Critical operations restricted to owner
- **PDA Validation**: Secure program-derived address usage
- **Account Validation**: Comprehensive account ownership checks

### Economic Security
- **Overflow Protection**: All arithmetic operations use checked math
- **Phase Validation**: Strict phase progression rules
- **Sale State Validation**: Comprehensive sale status checks

### Best Practices
- **Input Validation**: All parameters validated before processing
- **Error Handling**: Comprehensive error codes and messages
- **State Consistency**: Atomic state updates
- **Access Control**: Principle of least privilege

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Code Standards

- **Rust**: Follow standard Rust formatting
- **TypeScript**: Use Prettier for formatting
- **Documentation**: Update README for new features
- **Testing**: Maintain test coverage

### Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add appropriate error handling
4. Include test cases
5. Follow commit message conventions

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Anchor Framework**: [https://www.anchor-lang.com/](https://www.anchor-lang.com/)
- **Solana Documentation**: [https://docs.solana.com/](https://docs.solana.com/)
- **SPL Token Program**: [https://spl.solana.com/token](https://spl.solana.com/token)

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the test cases for usage examples

---

**Note**: This program is designed for educational and development purposes. Always conduct thorough testing before deploying to mainnet and consider security audits for production use.
