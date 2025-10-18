import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VelirionSpl } from "../target/types/velirion_spl";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createAccount, getAccount } from "@solana/spl-token";

async function testDeployment() {
  console.log("Testing Velirion SPL Token deployment...");

  // Configure the client
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.VelirionSpl as Program<VelirionSpl>;
  const provider = anchor.getProvider();

  // Test accounts
  const authority = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();
  const mint = Keypair.generate();
  const authorityTokenAccount = Keypair.generate();
  const user1TokenAccount = Keypair.generate();
  const user2TokenAccount = Keypair.generate();

  console.log("Generated test accounts...");

  // Airdrop SOL
  console.log("Requesting airdrops...");
  await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await provider.connection.requestAirdrop(user1.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await provider.connection.requestAirdrop(user2.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

  // Wait for airdrops
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Calculate token state PDA
  const [tokenState] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_state"), mint.publicKey.toBuffer()],
    program.programId
  );

  try {
    // Step 1: Initialize token
    console.log("\n=== Step 1: Initialize Token ===");
    await program.methods
      .initializeToken(
        "Velirion",
        "VLR",
        9,
        new anchor.BN(1000000 * 10 ** 9) // 1M tokens
      )
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

    console.log("✓ Token initialized successfully");

    // Step 2: Create user token accounts
    console.log("\n=== Step 2: Create User Token Accounts ===");
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

    console.log("✓ User token accounts created");

    // Step 3: Mint tokens to users
    console.log("\n=== Step 3: Mint Tokens to Users ===");
    const user1Amount = new anchor.BN(100000 * 10 ** 9);
    const user2Amount = new anchor.BN(200000 * 10 ** 9);

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

    console.log("✓ Tokens minted to users");

    // Step 4: Verify balances
    console.log("\n=== Step 4: Verify Balances ===");
    const user1Balance = await getAccount(provider.connection, user1TokenAccount.publicKey);
    const user2Balance = await getAccount(provider.connection, user2TokenAccount.publicKey);
    const authorityBalance = await getAccount(provider.connection, authorityTokenAccount.publicKey);

    console.log(`User1 balance: ${user1Balance.amount.toString()}`);
    console.log(`User2 balance: ${user2Balance.amount.toString()}`);
    console.log(`Authority balance: ${authorityBalance.amount.toString()}`);

    // Step 5: Test burning
    console.log("\n=== Step 5: Test Burning ===");
    const burnAmount = new anchor.BN(50000 * 10 ** 9);

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

    console.log("✓ Tokens burned successfully");

    // Step 6: Test authority transfer
    console.log("\n=== Step 6: Test Authority Transfer ===");
    await program.methods
      .transferAuthority(user1.publicKey)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    console.log("✓ Authority transferred successfully");

    // Step 7: Test new authority can mint
    console.log("\n=== Step 7: Test New Authority Minting ===");
    const newMintAmount = new anchor.BN(25000 * 10 ** 9);

    await program.methods
      .mintTokens(newMintAmount)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        toTokenAccount: user2TokenAccount.publicKey,
        authority: user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    console.log("✓ New authority minted tokens successfully");

    // Step 8: Final state verification
    console.log("\n=== Step 8: Final State Verification ===");
    const finalTokenState = await program.account.tokenState.fetch(tokenState);
    const finalUser1Balance = await getAccount(provider.connection, user1TokenAccount.publicKey);
    const finalUser2Balance = await getAccount(provider.connection, user2TokenAccount.publicKey);

    console.log("Final Token State:");
    console.log(`- Total Supply: ${finalTokenState.totalSupply.toString()}`);
    console.log(`- Circulating Supply: ${finalTokenState.circulatingSupply.toString()}`);
    console.log(`- Burned Supply: ${finalTokenState.burnedSupply.toString()}`);
    console.log(`- Authority: ${finalTokenState.authority.toString()}`);

    console.log("Final Balances:");
    console.log(`- User1: ${finalUser1Balance.amount.toString()}`);
    console.log(`- User2: ${finalUser2Balance.amount.toString()}`);

    console.log("\n🎉 All tests passed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

testDeployment()
  .then(() => {
    console.log("Test deployment completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test deployment failed:", error);
    process.exit(1);
  });
