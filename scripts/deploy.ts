import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VelirionSpl } from "../target/types/velirion_spl";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

async function main() {
  console.log("Starting Velirion SPL Token deployment...");

  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.VelirionSpl as Program<VelirionSpl>;
  const provider = anchor.getProvider();

  // Generate deployment accounts
  const authority = Keypair.generate();
  const mint = Keypair.generate();
  const authorityTokenAccount = Keypair.generate();

  console.log("Authority:", authority.publicKey.toString());
  console.log("Mint:", mint.publicKey.toString());
  console.log("Authority Token Account:", authorityTokenAccount.publicKey.toString());

  // Airdrop SOL to authority
  console.log("Requesting airdrop for authority...");
  const signature = await provider.connection.requestAirdrop(
    authority.publicKey,
    2 * anchor.web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(signature);
  console.log("Airdrop confirmed");

  // Calculate token state PDA
  const [tokenState] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_state"), mint.publicKey.toBuffer()],
    program.programId
  );

  console.log("Token State PDA:", tokenState.toString());

  // Deploy and initialize token
  try {
    console.log("Initializing token...");
    const tx = await program.methods
      .initializeToken(
        "Velirion",
        "VLR",
        9,
        new anchor.BN(1000000000 * 10 ** 9) // 1 billion tokens
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

    console.log("Token initialized successfully!");
    console.log("Transaction signature:", tx);

    // Fetch and display token state
    const tokenStateAccount = await program.account.tokenState.fetch(tokenState);
    console.log("\n=== Token State ===");
    console.log("Name:", tokenStateAccount.name);
    console.log("Symbol:", tokenStateAccount.symbol);
    console.log("Decimals:", tokenStateAccount.decimals);
    console.log("Total Supply:", tokenStateAccount.totalSupply.toString());
    console.log("Circulating Supply:", tokenStateAccount.circulatingSupply.toString());
    console.log("Burned Supply:", tokenStateAccount.burnedSupply.toString());
    console.log("Authority:", tokenStateAccount.authority.toString());
    console.log("Is Initialized:", tokenStateAccount.isInitialized);

    console.log("\n=== Deployment Complete ===");
    console.log("Program ID:", program.programId.toString());
    console.log("Token State:", tokenState.toString());
    console.log("Mint:", mint.publicKey.toString());
    console.log("Authority:", authority.publicKey.toString());

  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => {
    console.log("Deployment script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment script failed:", error);
    process.exit(1);
  });
