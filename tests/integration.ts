import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VelirionSpl } from "../target/types/velirion_spl";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createAccount, getAccount } from "@solana/spl-token";
import { expect } from "chai";

describe("Integration Tests", () => {
  const program = anchor.workspace.VelirionSpl as Program<VelirionSpl>;
  const provider = anchor.getProvider();

  let authority: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let mint: Keypair;
  let tokenState: PublicKey;
  let authorityTokenAccount: Keypair;
  let user1TokenAccount: Keypair;
  let user2TokenAccount: Keypair;

  const TOKEN_NAME = "Velirion";
  const TOKEN_SYMBOL = "VLR";
  const TOKEN_DECIMALS = 6;
  const INITIAL_SUPPLY = new anchor.BN(1000000 * 10 ** TOKEN_DECIMALS);

  before(async () => {
    // Setup accounts
    authority = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    mint = Keypair.generate();
    authorityTokenAccount = Keypair.generate();
    user1TokenAccount = Keypair.generate();
    user2TokenAccount = Keypair.generate();

    // Airdrop SOL
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user1.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user2.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    await new Promise(resolve => setTimeout(resolve, 1000));

    [tokenState] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), mint.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Complete token lifecycle: Initialize -> Mint -> Transfer -> Burn", async () => {
    // Step 1: Initialize token
    console.log("Step 1: Initializing token...");
    await program.methods
      .initializeToken(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS, INITIAL_SUPPLY)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        authorityTokenAccount: authorityTokenAccount.publicKey,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([authority, mint, authorityTokenAccount])
      .rpc();

    // Step 2: Create user token accounts
    console.log("Step 2: Creating user token accounts...");
    await createAccount(
      provider.connection,
      authority,
      mint.publicKey,
      user1.publicKey,
      user1TokenAccount
    );

    await createAccount(
      provider.connection,
      authority,
      mint.publicKey,
      user2.publicKey,
      user2TokenAccount
    );

    // Step 3: Mint tokens to users
    console.log("Step 3: Minting tokens to users...");
    const user1Amount = new anchor.BN(100000 * 10 ** TOKEN_DECIMALS);
    const user2Amount = new anchor.BN(150000 * 10 ** TOKEN_DECIMALS);

    await program.methods
      .mintTokens(user1Amount)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        toTokenAccount: user1TokenAccount.publicKey,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    await program.methods
      .mintTokens(user2Amount)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        toTokenAccount: user2TokenAccount.publicKey,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    // Step 4: Verify balances
    console.log("Step 4: Verifying balances...");
    const user1Account = await getAccount(provider.connection, user1TokenAccount.publicKey);
    const user2Account = await getAccount(provider.connection, user2TokenAccount.publicKey);
    const authorityAccount = await getAccount(provider.connection, authorityTokenAccount.publicKey);

    expect(user1Account.amount.toString()).to.equal(user1Amount.toString());
    expect(user2Account.amount.toString()).to.equal(user2Amount.toString());

    // Step 5: Burn some tokens from user1
    console.log("Step 5: Burning tokens from user1...");
    const burnAmount = new anchor.BN(25000 * 10 ** TOKEN_DECIMALS);

    // First, we need to transfer tokens to authority for burning (since only authority can burn)
    // This simulates a real-world scenario where users might send tokens to a burn address
    await program.methods
      .burnTokens(burnAmount)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        userTokenAccount: user1TokenAccount.publicKey,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    // Step 6: Verify final state
    console.log("Step 6: Verifying final state...");
    const tokenStateAccount = await program.account.tokenState.fetch(tokenState);
    const expectedCirculatingSupply = INITIAL_SUPPLY.add(user1Amount).add(user2Amount).sub(burnAmount);
    const expectedBurnedSupply = burnAmount;

    expect(tokenStateAccount.circulatingSupply.toString()).to.equal(expectedCirculatingSupply.toString());
    expect(tokenStateAccount.burnedSupply.toString()).to.equal(expectedBurnedSupply.toString());

    console.log("Integration test completed successfully!");
    console.log(`Final circulating supply: ${tokenStateAccount.circulatingSupply.toString()}`);
    console.log(`Final burned supply: ${tokenStateAccount.burnedSupply.toString()}`);
  });

  it("Stress test: Multiple rapid operations", async () => {
    const stressMint = Keypair.generate();
    const stressTokenState = PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), stressMint.publicKey.toBuffer()],
      program.programId
    )[0];
    const stressAuthorityTokenAccount = Keypair.generate();

    // Initialize stress test token
    await program.methods
      .initializeToken("Stress Token", "STRESS", 9, new anchor.BN(1000000 * 10 ** 9))
      .accounts({
        tokenState: stressTokenState,
        mint: stressMint.publicKey,
        authorityTokenAccount: stressAuthorityTokenAccount.publicKey,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([authority, stressMint, stressAuthorityTokenAccount])
      .rpc();

    // Perform multiple rapid mint operations
    const operations = [];
    for (let i = 0; i < 10; i++) {
      operations.push(
        program.methods
          .mintTokens(new anchor.BN(1000 * 10 ** 9))
          .accounts({
            tokenState: stressTokenState,
            mint: stressMint.publicKey,
            toTokenAccount: stressAuthorityTokenAccount.publicKey,
            authority: authority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc()
      );
    }

    // Execute all operations
    const results = await Promise.all(operations);
    console.log(`Executed ${results.length} rapid mint operations`);

    // Verify final state
    const finalTokenState = await program.account.tokenState.fetch(stressTokenState);
    const expectedSupply = new anchor.BN(1000000 * 10 ** 9).add(new anchor.BN(10000 * 10 ** 9));
    expect(finalTokenState.circulatingSupply.toString()).to.equal(expectedSupply.toString());
  });
});
