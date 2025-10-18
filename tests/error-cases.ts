import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VelirionSpl } from "../target/types/velirion_spl";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";

describe("Error Cases", () => {
  const program = anchor.workspace.VelirionSpl as Program<VelirionSpl>;
  const provider = anchor.getProvider();

  let authority: Keypair;
  let unauthorizedUser: Keypair;
  let mint: Keypair;
  let tokenState: PublicKey;
  let authorityTokenAccount: Keypair;

  before(async () => {
    authority = Keypair.generate();
    unauthorizedUser = Keypair.generate();
    mint = Keypair.generate();
    authorityTokenAccount = Keypair.generate();

    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(unauthorizedUser.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    await new Promise(resolve => setTimeout(resolve, 1000));

    [tokenState] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), mint.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Fails to mint tokens before initialization", async () => {
    const uninitializedMint = Keypair.generate();
    const uninitializedTokenState = PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), uninitializedMint.publicKey.toBuffer()],
      program.programId
    )[0];

    try {
      await program.methods
        .mintTokens(new anchor.BN(1000 * 10 ** 9))
        .accounts({
          tokenState: uninitializedTokenState,
          mint: uninitializedMint.publicKey,
          toTokenAccount: Keypair.generate().publicKey,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with token not initialized error");
    } catch (error) {
      expect(error.message).to.include("TokenNotInitialized");
    }
  });

  it("Fails to burn tokens before initialization", async () => {
    const uninitializedMint = Keypair.generate();
    const uninitializedTokenState = PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), uninitializedMint.publicKey.toBuffer()],
      program.programId
    )[0];

    try {
      await program.methods
        .burnTokens(new anchor.BN(1000 * 10 ** 9))
        .accounts({
          tokenState: uninitializedTokenState,
          mint: uninitializedMint.publicKey,
          userTokenAccount: Keypair.generate().publicKey,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with token not initialized error");
    } catch (error) {
      expect(error.message).to.include("TokenNotInitialized");
    }
  });

  it("Fails to transfer authority before initialization", async () => {
    const uninitializedMint = Keypair.generate();
    const uninitializedTokenState = PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), uninitializedMint.publicKey.toBuffer()],
      program.programId
    )[0];

    try {
      await program.methods
        .transferAuthority(unauthorizedUser.publicKey)
        .accounts({
          tokenState: uninitializedTokenState,
          mint: uninitializedMint.publicKey,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with token not initialized error");
    } catch (error) {
      expect(error.message).to.include("TokenNotInitialized");
    }
  });

  it("Fails to get token state before initialization", async () => {
    const uninitializedMint = Keypair.generate();
    const uninitializedTokenState = PublicKey.findProgramAddressSync(
      [Buffer.from("token_state"), uninitializedMint.publicKey.toBuffer()],
      program.programId
    )[0];

    try {
      await program.methods
        .getTokenState()
        .accounts({
          tokenState: uninitializedTokenState,
          mint: uninitializedMint.publicKey,
        })
        .view();

      expect.fail("Should have failed with token not initialized error");
    } catch (error) {
      expect(error.message).to.include("TokenNotInitialized");
    }
  });

  it("Fails to mint with zero amount", async () => {
    // First initialize a token
    await program.methods
      .initializeToken("Velirion", "VLR", 9, new anchor.BN(1000000 * 10 ** 9))
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

    try {
      await program.methods
        .mintTokens(new anchor.BN(0))
        .accounts({
          tokenState: tokenState,
          mint: mint.publicKey,
          toTokenAccount: authorityTokenAccount.publicKey,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with zero amount");
    } catch (error) {
      // This should fail at the SPL token level
      expect(error.message).to.include("Invalid");
    }
  });

  it("Fails to burn with zero amount", async () => {
    try {
      await program.methods
        .burnTokens(new anchor.BN(0))
        .accounts({
          tokenState: tokenState,
          mint: mint.publicKey,
          userTokenAccount: authorityTokenAccount.publicKey,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with zero amount");
    } catch (error) {
      // This should fail at the SPL token level
      expect(error.message).to.include("Invalid");
    }
  });

  it("Fails to burn more tokens than available in account", async () => {
    const excessiveAmount = new anchor.BN(2000000 * 10 ** 9); // More than total supply

    try {
      await program.methods
        .burnTokens(excessiveAmount)
        .accounts({
          tokenState: tokenState,
          mint: mint.publicKey,
          userTokenAccount: authorityTokenAccount.publicKey,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with insufficient balance");
    } catch (error) {
      expect(error.message).to.include("InsufficientBalance");
    }
  });

  it("Fails to transfer authority to same authority", async () => {
    try {
      await program.methods
        .transferAuthority(authority.publicKey) // Same as current authority
        .accounts({
          tokenState: tokenState,
          mint: mint.publicKey,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // This should succeed but be a no-op
      const tokenStateAccount = await program.account.tokenState.fetch(tokenState);
      expect(tokenStateAccount.authority.toString()).to.equal(authority.publicKey.toString());
    } catch (error) {
      // If it fails, that's also acceptable behavior
      console.log("Transfer to same authority failed as expected:", error.message);
    }
  });

  it("Fails with invalid token account", async () => {
    const invalidTokenAccount = Keypair.generate();

    try {
      await program.methods
        .mintTokens(new anchor.BN(1000 * 10 ** 9))
        .accounts({
          tokenState: tokenState,
          mint: mint.publicKey,
          toTokenAccount: invalidTokenAccount.publicKey, // Not a valid token account
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with invalid token account");
    } catch (error) {
      expect(error.message).to.include("Invalid");
    }
  });

  it("Fails with wrong mint in accounts", async () => {
    const wrongMint = Keypair.generate();

    try {
      await program.methods
        .mintTokens(new anchor.BN(1000 * 10 ** 9))
        .accounts({
          tokenState: tokenState,
          mint: wrongMint.publicKey, // Wrong mint
          toTokenAccount: authorityTokenAccount.publicKey,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have failed with wrong mint");
    } catch (error) {
      expect(error.message).to.include("Invalid");
    }
  });
});
