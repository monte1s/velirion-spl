import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VelirionSpl } from "../target/types/velirion_spl";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, burn, getAccount } from "@solana/spl-token";
import { expect } from "chai";

describe("velirion-spl", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.VelirionSpl as Program<VelirionSpl>;
  const provider = anchor.getProvider();

  // Test accounts
  let authority: Keypair;
  let newAuthority: Keypair;
  let user: Keypair;
  let mint: Keypair;
  let tokenState: PublicKey;
  let authorityTokenAccount: Keypair;
  let userTokenAccount: Keypair;

  const TOKEN_NAME = "Velirion";
  const TOKEN_SYMBOL = "VLR";
  const TOKEN_DECIMALS = 9;
  const INITIAL_SUPPLY = new anchor.BN(1000000 * 10 ** TOKEN_DECIMALS); // 1M tokens

  before(async () => {
    // Generate keypairs
    authority = Keypair.generate();
    newAuthority = Keypair.generate();
    user = Keypair.generate();
    mint = Keypair.generate();
    authorityTokenAccount = Keypair.generate();
    userTokenAccount = Keypair.generate();

    // Airdrop SOL to accounts
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(newAuthority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    // Wait for airdrops to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Calculate token state PDA
    [tokenState] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), mint.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initializes token with correct parameters", async () => {
    const tx = await program.methods
      .initializeToken(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        TOKEN_DECIMALS,
        INITIAL_SUPPLY
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

    console.log("Initialize token signature:", tx);

    // Verify token state
    const tokenStateAccount = await program.account.tokenState.fetch(tokenState);
    expect(tokenStateAccount.mint.toString()).to.equal(mint.publicKey.toString());
    expect(tokenStateAccount.authority.toString()).to.equal(authority.publicKey.toString());
    expect(tokenStateAccount.name).to.equal(TOKEN_NAME);
    expect(tokenStateAccount.symbol).to.equal(TOKEN_SYMBOL);
    expect(tokenStateAccount.decimals).to.equal(TOKEN_DECIMALS);
    expect(tokenStateAccount.totalSupply.toString()).to.equal(INITIAL_SUPPLY.toString());
    expect(tokenStateAccount.circulatingSupply.toString()).to.equal(INITIAL_SUPPLY.toString());
    expect(tokenStateAccount.burnedSupply.toString()).to.equal("0");
    expect(tokenStateAccount.isInitialized).to.be.true;

    // Verify authority has the initial supply
    const authorityAccount = await getAccount(provider.connection, authorityTokenAccount.publicKey);
    expect(authorityAccount.amount.toString()).to.equal(INITIAL_SUPPLY.toString());
  });

  it("Mints additional tokens", async () => {
    const mintAmount = new anchor.BN(100000 * 10 ** TOKEN_DECIMALS); // 100K tokens

    const tx = await program.methods
      .mintTokens(mintAmount)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        toTokenAccount: authorityTokenAccount.publicKey,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    console.log("Mint tokens signature:", tx);

    // Verify updated supply
    const tokenStateAccount = await program.account.tokenState.fetch(tokenState);
    const expectedTotalSupply = INITIAL_SUPPLY.add(mintAmount);
    const expectedCirculatingSupply = INITIAL_SUPPLY.add(mintAmount);

    expect(tokenStateAccount.totalSupply.toString()).to.equal(expectedTotalSupply.toString());
    expect(tokenStateAccount.circulatingSupply.toString()).to.equal(expectedCirculatingSupply.toString());

    // Verify authority's token account
    const authorityAccount = await getAccount(provider.connection, authorityTokenAccount.publicKey);
    expect(authorityAccount.amount.toString()).to.equal(expectedTotalSupply.toString());
  });

  it("Fails to mint tokens with unauthorized user", async () => {
    const mintAmount = new anchor.BN(1000 * 10 ** TOKEN_DECIMALS);

    try {
      await program.methods
        .mintTokens(mintAmount)
        .accounts({
          tokenState: tokenState,
          mint: mint.publicKey,
          toTokenAccount: authorityTokenAccount.publicKey,
          authority: user.publicKey, // Using unauthorized user
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      expect.fail("Should have failed with unauthorized error");
    } catch (error) {
      expect(error.message).to.include("Unauthorized");
    }
  });

  it("Burns tokens and reduces supply", async () => {
    const burnAmount = new anchor.BN(50000 * 10 ** TOKEN_DECIMALS); // 50K tokens

    const tx = await program.methods
      .burnTokens(burnAmount)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        userTokenAccount: authorityTokenAccount.publicKey,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    console.log("Burn tokens signature:", tx);

    // Verify updated supply
    const tokenStateAccount = await program.account.tokenState.fetch(tokenState);
    const expectedCirculatingSupply = INITIAL_SUPPLY.add(new anchor.BN(100000 * 10 ** TOKEN_DECIMALS)).sub(burnAmount);
    const expectedBurnedSupply = burnAmount;

    expect(tokenStateAccount.circulatingSupply.toString()).to.equal(expectedCirculatingSupply.toString());
    expect(tokenStateAccount.burnedSupply.toString()).to.equal(expectedBurnedSupply.toString());

    // Verify authority's token account
    const authorityAccount = await getAccount(provider.connection, authorityTokenAccount.publicKey);
    expect(authorityAccount.amount.toString()).to.equal(expectedCirculatingSupply.toString());
  });

  it("Fails to burn more tokens than available", async () => {
    const excessiveBurnAmount = new anchor.BN(1000000 * 10 ** TOKEN_DECIMALS); // 1M tokens (more than available)

    try {
      await program.methods
        .burnTokens(excessiveBurnAmount)
        .accounts({
          tokenState: tokenState,
          mint: mint.publicKey,
          userTokenAccount: authorityTokenAccount.publicKey,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with insufficient balance error");
    } catch (error) {
      expect(error.message).to.include("InsufficientBalance");
    }
  });

  it("Transfers authority to new authority", async () => {
    const tx = await program.methods
      .transferAuthority(newAuthority.publicKey)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    console.log("Transfer authority signature:", tx);

    // Verify authority transfer
    const tokenStateAccount = await program.account.tokenState.fetch(tokenState);
    expect(tokenStateAccount.authority.toString()).to.equal(newAuthority.publicKey.toString());
  });

  it("New authority can mint tokens", async () => {
    const mintAmount = new anchor.BN(25000 * 10 ** TOKEN_DECIMALS); // 25K tokens

    const tx = await program.methods
      .mintTokens(mintAmount)
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
        toTokenAccount: authorityTokenAccount.publicKey,
        authority: newAuthority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([newAuthority])
      .rpc();

    console.log("New authority mint signature:", tx);

    // Verify updated supply
    const tokenStateAccount = await program.account.tokenState.fetch(tokenState);
    const expectedCirculatingSupply = INITIAL_SUPPLY
      .add(new anchor.BN(100000 * 10 ** TOKEN_DECIMALS))
      .sub(new anchor.BN(50000 * 10 ** TOKEN_DECIMALS))
      .add(mintAmount);

    expect(tokenStateAccount.circulatingSupply.toString()).to.equal(expectedCirculatingSupply.toString());
  });

  it("Old authority can no longer mint tokens", async () => {
    const mintAmount = new anchor.BN(1000 * 10 ** TOKEN_DECIMALS);

    try {
      await program.methods
        .mintTokens(mintAmount)
        .accounts({
          tokenState: tokenState,
          mint: mint.publicKey,
          toTokenAccount: authorityTokenAccount.publicKey,
          authority: authority.publicKey, // Old authority
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with unauthorized error");
    } catch (error) {
      expect(error.message).to.include("Unauthorized");
    }
  });

  it("Gets token state information", async () => {
    const tokenStateInfo = await program.methods
      .getTokenState()
      .accounts({
        tokenState: tokenState,
        mint: mint.publicKey,
      })
      .view();

    expect(tokenStateInfo.mint.toString()).to.equal(mint.publicKey.toString());
    expect(tokenStateInfo.authority.toString()).to.equal(newAuthority.publicKey.toString());
    expect(tokenStateInfo.name).to.equal(TOKEN_NAME);
    expect(tokenStateInfo.symbol).to.equal(TOKEN_SYMBOL);
    expect(tokenStateInfo.decimals).to.equal(TOKEN_DECIMALS);
    expect(tokenStateInfo.isInitialized).to.be.true;
  });

  it("Fails to initialize token twice", async () => {
    const duplicateMint = Keypair.generate();
    const duplicateTokenState = PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), duplicateMint.publicKey.toBuffer()],
      program.programId
    )[0];

    try {
      await program.methods
        .initializeToken(
          "Duplicate Token",
          "DUP",
          9,
          new anchor.BN(1000000 * 10 ** 9)
        )
        .accounts({
          tokenState: duplicateTokenState,
          mint: duplicateMint.publicKey,
          authorityTokenAccount: Keypair.generate().publicKey,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([authority, duplicateMint, Keypair.generate()])
        .rpc();

      expect.fail("Should have failed with account already in use error");
    } catch (error) {
      expect(error.message).to.include("already in use");
    }
  });

  it("Handles supply overflow protection", async () => {
    const maxU64 = new anchor.BN("18446744073709551615"); // Max u64 value

    try {
      await program.methods
        .mintTokens(maxU64)
        .accounts({
          tokenState: tokenState,
          mint: mint.publicKey,
          toTokenAccount: authorityTokenAccount.publicKey,
          authority: newAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([newAuthority])
        .rpc();

      expect.fail("Should have failed with supply overflow error");
    } catch (error) {
      expect(error.message).to.include("SupplyOverflow");
    }
  });
});
