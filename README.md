# Velirion SPL Token

A comprehensive SPL token smart contract built with Anchor framework, featuring supply management, burning functionality, and ownership controls.

## Features

- **Token Initialization**: Create tokens with custom name, symbol, decimals, and initial supply
- **Supply Management**: Track total supply, circulating supply, and burned supply
- **Minting**: Authority-controlled token minting with supply tracking
- **Burning**: Token burning functionality that reduces circulating supply
- **Ownership Controls**: Transfer authority between accounts
- **Security**: Comprehensive access controls and error handling
- **Events**: Emit events for all major operations

## Project Structure

```
velirion-spl/
├── programs/
│   └── velirion-spl/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs          # Main program logic
├── tests/
│   ├── velirion-spl.ts         # Core functionality tests
│   ├── integration.ts          # Integration tests
│   └── error-cases.ts          # Error handling tests
├── scripts/
│   ├── deploy.ts               # Deployment script
│   └── test-deployment.ts      # Test deployment script
├── Anchor.toml                 # Anchor configuration
├── package.json               # Dependencies
└── README.md                  # This file
```

## Installation

1. **Prerequisites**:
   - Rust (latest stable)
   - Solana CLI (latest)
   - Anchor Framework (latest)
   - Node.js (v16+)

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the program**:
   ```bash
   anchor build
   ```

4. **Run tests**:
   ```bash
   anchor test
   ```

## Usage

### Initialize Token

```typescript
await program.methods
  .initializeToken(
    "Velirion",         // name
    "VLR",              // symbol
    9,                  // decimals
    new anchor.BN(1000000 * 10 ** 9) // initial supply
  .accounts({
    tokenState: tokenStatePDA,
    mint: mintKeypair.publicKey,
    authorityTokenAccount: authorityTokenAccount.publicKey,
    authority: authority.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .signers([authority, mintKeypair, authorityTokenAccount])
  .rpc();
```

### Mint Tokens

```typescript
await program.methods
  .mintTokens(new anchor.BN(100000 * 10 ** 9))
  .accounts({
    tokenState: tokenStatePDA,
    mint: mint.publicKey,
    toTokenAccount: recipientTokenAccount.publicKey,
    authority: authority.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .signers([authority])
  .rpc();
```

### Burn Tokens

```typescript
await program.methods
  .burnTokens(new anchor.BN(50000 * 10 ** 9))
  .accounts({
    tokenState: tokenStatePDA,
    mint: mint.publicKey,
    userTokenAccount: userTokenAccount.publicKey,
    authority: authority.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .signers([authority])
  .rpc();
```

### Transfer Authority

```typescript
await program.methods
  .transferAuthority(newAuthority.publicKey)
  .accounts({
    tokenState: tokenStatePDA,
    mint: mint.publicKey,
    authority: currentAuthority.publicKey,
  })
  .signers([currentAuthority])
  .rpc();
```

## Program Architecture

### Accounts

- **TokenState**: PDA that stores token metadata and supply information
- **Mint**: SPL token mint account
- **TokenAccount**: SPL token accounts for holding tokens

### Instructions

1. **initialize_token**: Initialize a new token with initial supply
2. **mint_tokens**: Mint new tokens (authority only)
3. **burn_tokens**: Burn tokens and reduce supply (authority only)
4. **transfer_authority**: Transfer ownership to new authority
5. **get_token_state**: View token state information

### Events

- **TokenInitialized**: Emitted when token is initialized
- **TokensMinted**: Emitted when tokens are minted
- **TokensBurned**: Emitted when tokens are burned
- **AuthorityTransferred**: Emitted when authority is transferred

## Security Features

- **Access Control**: Only authorized accounts can mint/burn tokens
- **Supply Validation**: Prevents supply overflow/underflow
- **Balance Checks**: Ensures sufficient balance before burning
- **PDA Security**: Uses Program Derived Addresses for secure account management

## Error Handling

The program includes comprehensive error handling for:

- Unauthorized access attempts
- Supply overflow/underflow
- Insufficient balances
- Uninitialized tokens
- Invalid account configurations

## Testing

The project includes three test suites:

1. **Core Tests** (`velirion-spl.ts`): Basic functionality testing
2. **Integration Tests** (`integration.ts`): End-to-end workflow testing
3. **Error Cases** (`error-cases.ts`): Error handling and edge cases

Run all tests:
```bash
anchor test
```

Run specific test file:
```bash
anchor test --skip-local-validator
```

## Deployment

### Local Development

1. Start local validator:
   ```bash
   solana-test-validator
   ```

2. Deploy program:
   ```bash
   anchor deploy
   ```

3. Run deployment script:
   ```bash
   ts-node scripts/deploy.ts
   ```

### Mainnet Deployment

1. Update `Anchor.toml` with mainnet cluster
2. Build and deploy:
   ```bash
   anchor build
   anchor deploy --provider.cluster mainnet
   ```

## API Reference

### TokenState Account

```rust
pub struct TokenState {
    pub mint: Pubkey,              // Token mint address
    pub authority: Pubkey,         // Current authority
    pub name: String,              // Token name
    pub symbol: String,            // Token symbol
    pub decimals: u8,              // Token decimals
    pub total_supply: u64,         // Total supply ever created
    pub circulating_supply: u64,    // Current circulating supply
    pub burned_supply: u64,        // Total burned supply
    pub is_initialized: bool,      // Initialization status
    pub bump: u8,                  // PDA bump seed
}
```

### Error Codes

- `TokenNotInitialized`: Token has not been initialized
- `Unauthorized`: Unauthorized access attempt
- `SupplyOverflow`: Supply calculation overflow
- `SupplyUnderflow`: Supply calculation underflow
- `InsufficientBalance`: Insufficient token balance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions and support, please open an issue on GitHub or contact the development team.

---

**Note**: This is a production-ready SPL token implementation. Always test thoroughly before deploying to mainnet.
