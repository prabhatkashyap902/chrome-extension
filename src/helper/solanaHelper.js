import { Connection, Transaction, SystemProgram, PublicKey } from "@solana/web3.js";

export const sendTestTransaction = async (walletAddress) => {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(walletAddress),
      toPubkey: new PublicKey(walletAddress),
      lamports: 1000
    })
  );

  tx.feePayer = new PublicKey(walletAddress);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  return tx;
};
