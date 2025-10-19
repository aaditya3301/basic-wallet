"use client";

import { useState } from "react";
import { generateMnemonic, mnemonicToSeedSync } from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import { ethers } from "ethers";
import nacl from "tweetnacl";

interface Wallet {
  id: number;
  solanaAddress: string;
  ethereumAddress: string;
  privateKey: string;
  solanaBalance?: string;
  ethereumBalance?: string;
}

export default function Home() {
  const [mnemonic, setMnemonic] = useState<string>("");
  const [inputMnemonic, setInputMnemonic] = useState<string>("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [showPrivateKey, setShowPrivateKey] = useState<{ [key: number]: boolean }>({});
  const [showMnemonic, setShowMnemonic] = useState<boolean>(false);
  const [loadingBalances, setLoadingBalances] = useState<{ [key: number]: boolean }>({});

  const generateSecretPhrase = () => {
    const newMnemonic = generateMnemonic();
    setMnemonic(newMnemonic);
    setInputMnemonic(newMnemonic);
    setWallets([]);
  };

  const createWallet = () => {
    const mnemonicToUse = inputMnemonic || mnemonic;
    if (!mnemonicToUse) {
      return;
    }

    try {
      const seed = mnemonicToSeedSync(mnemonicToUse);
      const walletIndex = wallets.length;

      // Generate Solana address
      const solanaPath = `m/44'/501'/${walletIndex}'/0'`;
      const solanaDerivedSeed = derivePath(solanaPath, seed.toString("hex")).key;
      const solanaSecret = nacl.sign.keyPair.fromSeed(solanaDerivedSeed).secretKey;
      const solanaAddress = Keypair.fromSecretKey(solanaSecret).publicKey.toBase58();
      const solanaPrivateKey = Buffer.from(solanaDerivedSeed).toString("hex");

      // Generate Ethereum address  
      const ethereumPath = `m/44'/60'/${walletIndex}'/0'`;
      const ethereumDerivedSeed = derivePath(ethereumPath, seed.toString("hex")).key;
      const ethereumWallet = new ethers.Wallet(Buffer.from(ethereumDerivedSeed).toString("hex"));
      const ethereumAddress = ethereumWallet.address;

      const newWallet: Wallet = {
        id: walletIndex + 1,
        solanaAddress,
        ethereumAddress,
        privateKey: solanaPrivateKey,
      };

      setWallets([...wallets, newWallet]);
      setMnemonic(mnemonicToUse);
    } catch (error) {
      // Silent fail
    }
  };

  const clearWallets = () => {
    setWallets([]);
    setMnemonic("");
    setInputMnemonic("");
    setShowMnemonic(false);
    setShowPrivateKey({});
  };

  const togglePrivateKey = (walletId: number) => {
    setShowPrivateKey(prev => ({
      ...prev,
      [walletId]: !prev[walletId]
    }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Silent fail
    }
  };

  const fetchEthereumBalance = async (address: string): Promise<string> => {
    try {
      const response = await fetch("https://eth-mainnet.g.alchemy.com/v2/7ge-LLlsWzPMtoQ4Ab_ue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "eth_getBalance",
          params: [address, "latest"]
        })
      });

      const data = await response.json();
      if (data.result) {
        // Convert from wei to ETH
        const balanceInWei = BigInt(data.result);
        const balanceInEth = Number(balanceInWei) / Math.pow(10, 18);
        return balanceInEth.toFixed(6);
      }
      return "0.000000";
    } catch (error) {
      return "Error";
    }
  };

  const fetchSolanaBalance = async (address: string): Promise<string> => {
    try {
      const response = await fetch("https://solana-mainnet.g.alchemy.com/v2/7ge-LLlsWzPMtoQ4Ab_ue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "getBalance",
          params: [address]
        })
      });

      const data = await response.json();
      if (data.result && data.result.value !== undefined) {
        // Convert from lamports to SOL
        const balanceInLamports = data.result.value;
        const balanceInSol = balanceInLamports / Math.pow(10, 9);
        return balanceInSol.toFixed(6);
      }
      return "0.000000";
    } catch (error) {
      return "Error";
    }
  };

  const fetchWalletBalances = async (walletId: number) => {
    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) return;

    setLoadingBalances(prev => ({ ...prev, [walletId]: true }));

    try {
      const [ethBalance, solBalance] = await Promise.all([
        fetchEthereumBalance(wallet.ethereumAddress),
        fetchSolanaBalance(wallet.solanaAddress)
      ]);

      setWallets(prev => prev.map(w => 
        w.id === walletId 
          ? { ...w, ethereumBalance: ethBalance, solanaBalance: solBalance }
          : w
      ));
    } catch (error) {
      // Silent fail
    } finally {
      setLoadingBalances(prev => ({ ...prev, [walletId]: false }));
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">Aaditya's Wallet</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex items-center gap-2 text-sm"
            >
              <span></span>
              <div className="w-12 h-6 bg-gray-700 rounded-full relative">
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform duration-200 ${isDark ? "translate-x-6" : "translate-x-0.5"}`}></div>
              </div>
              <span></span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        {wallets.length === 0 ? (
          /* Initial Setup Screen */
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Secret Recovery Phrase</h1>
            <p className="text-gray-400 mb-12">Save these words in a safe place.</p>
            
            <div className="max-w-2xl mx-auto mb-8">
              <input
                type="text"
                value={inputMnemonic}
                onChange={(e) => setInputMnemonic(e.target.value)}
                placeholder="Enter your secret phrase (or leave blank to generate)"
                className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-gray-400 focus:outline-none"
              />
            </div>
            
            <button
              onClick={inputMnemonic ? createWallet : generateSecretPhrase}
              className="bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              {inputMnemonic ? "Generate Wallet" : "Generate Wallet"}
            </button>
          </div>
        ) : (
          /* Wallet Management Screen */
          <div>
            {/* Secret Phrase Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-medium">Your Secret Phrase</h2>
                <button 
                  onClick={() => setShowMnemonic(!showMnemonic)}
                  className="text-gray-400 hover:text-white"
                >
                  ▼
                </button>
              </div>
              
              {showMnemonic && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-4 gap-2 text-sm font-mono">
                    {mnemonic.split(" ").map((word, index) => (
                      <div key={index} className="bg-gray-800 px-3 py-2 rounded">
                        <span className="text-gray-500 mr-2">{index + 1}</span>
                        {word}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Solana Wallet Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Solana Wallet</h2>
                <div className="flex gap-2">
                  <button className="text-gray-400 hover:text-white">
                    ☰
                  </button>
                  <button
                    onClick={createWallet}
                    className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Add Wallet
                  </button>
                  <button
                    onClick={clearWallets}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Clear Wallets
                  </button>
                </div>
              </div>

              {/* Wallets List */}
              <div className="space-y-4">
                {wallets.map((wallet) => (
                  <div key={wallet.id} className="border border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between p-4 border-b border-gray-700">
                      <h3 className="text-lg font-medium">Wallet {wallet.id}</h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => fetchWalletBalances(wallet.id)}
                          disabled={loadingBalances[wallet.id]}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {loadingBalances[wallet.id] ? "Loading..." : "Refresh"}
                        </button>
                        <button className="text-red-500 hover:text-red-400">
                          🗑️
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Solana Address</label>
                          <button 
                            onClick={() => copyToClipboard(wallet.solanaAddress)}
                            className="text-gray-400 hover:text-white text-sm"
                          >
                            📋
                          </button>
                        </div>
                        <div className="font-mono text-sm bg-gray-900 p-3 rounded border border-gray-700 break-all">
                          {wallet.solanaAddress}
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-gray-400">Balance: </span>
                          <span className="text-green-400 font-medium">
                            {wallet.solanaBalance !== undefined ? `${wallet.solanaBalance} SOL` : "Click refresh to fetch"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Ethereum Address</label>
                          <button 
                            onClick={() => copyToClipboard(wallet.ethereumAddress)}
                            className="text-gray-400 hover:text-white text-sm"
                          >
                            📋
                          </button>
                        </div>
                        <div className="font-mono text-sm bg-gray-900 p-3 rounded border border-gray-700 break-all">
                          {wallet.ethereumAddress}
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-gray-400">Balance: </span>
                          <span className="text-blue-400 font-medium">
                            {wallet.ethereumBalance !== undefined ? `${wallet.ethereumBalance} ETH` : "Click refresh to fetch"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Private Key</label>
                          <button 
                            onClick={() => togglePrivateKey(wallet.id)}
                            className="text-gray-400 hover:text-white text-sm"
                          >
                            👁️
                          </button>
                        </div>
                        <div className="font-mono text-sm bg-gray-900 p-3 rounded border border-gray-700 break-all">
                          {showPrivateKey[wallet.id] ? wallet.privateKey : "•".repeat(80)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
