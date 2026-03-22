"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Web3 from "web3";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../config/contract";

interface Web3ContextType {
  account: string | null;
  web3: Web3 | null;
  contract: any | null;
  isConnected: boolean;
  isAdmin: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  chainId: number | null;
  error: string | null;
}

const Web3Context = createContext<Web3ContextType>({
  account: null,
  web3: null,
  contract: null,
  isConnected: false,
  isAdmin: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  chainId: null,
  error: null,
});

export const useWeb3 = () => useContext(Web3Context);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [account, setAccount] = useState<string | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [contract, setContract] = useState<any | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = async () => {
    try {
      setError(null);

      if (typeof window.ethereum === "undefined") {
        const errorMsg = "Please install MetaMask first!";
        setError(errorMsg);
        alert(errorMsg);
        return;
      }

      // Check if CONTRACT_ADDRESS is configured
      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "") {
        const errorMsg =
          "Contract address is not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env.local file.";
        setError(errorMsg);
        alert(errorMsg);
        return;
      }

      // Initialize Web3
      const web3Instance = new Web3(window.ethereum);

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length === 0) {
        throw new Error("No accounts found. Please connect your wallet.");
      }

      const userAccount = accounts[0];

      // Get current chain ID
      const chainId = await web3Instance.eth.getChainId();
      console.log("Current Chain ID:", chainId);

      // Sepolia chain ID
      const SEPOLIA_CHAIN_ID = 11155111;
      const SEPOLIA_HEX_CHAIN_ID = "0xaa36a7";

      // Check if we're on Sepolia
      if (Number(chainId) !== SEPOLIA_CHAIN_ID) {
        const userConfirmed = confirm(
          `You are on wrong network (Chain ID: ${chainId}).\n\n` +
            `Please switch to Sepolia Test Network (Chain ID: ${SEPOLIA_CHAIN_ID}) to use this app.\n\n` +
            `Click OK to switch network automatically.`
        );

        if (!userConfirmed) {
          alert("Please switch to Sepolia network manually in MetaMask.");
          return;
        }

        try {
          // Try to switch to Sepolia
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_HEX_CHAIN_ID }],
          });

          // Network switched successfully, reload the page
          window.location.reload();
          return;
        } catch (switchError: any) {
          // If network not added, add it
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: SEPOLIA_HEX_CHAIN_ID,
                    chainName: "Sepolia Test Network",
                    nativeCurrency: {
                      name: "Sepolia Ether",
                      symbol: "SEP",
                      decimals: 18,
                    },
                    rpcUrls: ["https://rpc.sepolia.org"],
                    blockExplorerUrls: ["https://sepolia.etherscan.io"],
                  },
                ],
              });

              // Network added, reload the page
              window.location.reload();
              return;
            } catch (addError) {
              console.error("Error adding Sepolia network:", addError);
              alert(
                "Failed to add Sepolia network. Please add it manually in MetaMask."
              );
              return;
            }
          } else {
            console.error("Error switching network:", switchError);
            alert(
              "Failed to switch network. Please switch to Sepolia manually."
            );
            return;
          }
        }
      }

      // Now we're on Sepolia, continue with connection
      console.log("✅ Connected to Sepolia network");

      // Get chain ID
      const networkId = await web3Instance.eth.getChainId();
      console.log("Chain ID", networkId);

      // Check if contract exists at the address
      const code = await web3Instance.eth.getCode(CONTRACT_ADDRESS);
      console.log("Contract code at address:", code.substring(0, 50) + "...");

      if (code === "0x" || code === "0x0") {
        const errorMsg =
          `⚠️ No contract found at address ${CONTRACT_ADDRESS} on Sepolia network.\n\n` +
          `Please ensure:\n` +
          `1. The contract is deployed on Sepolia\n` +
          `2. The contract address is correct\n` +
          `3. You're connected to Sepolia (Chain ID: 11155111)`;
        console.error(errorMsg);
        alert(errorMsg);
        setError(errorMsg);
        return;
      }

      // Create contract instance
      const contractInstance = new web3Instance.eth.Contract(
        CONTRACT_ABI,
        CONTRACT_ADDRESS
      );

      // Check if user is admin
      try {
        const adminAddress = await contractInstance.methods.admin().call();
        console.log("Admin address:", adminAddress);
        const isUserAdmin =
          (adminAddress as unknown as string).toLowerCase() ===
          userAccount.toLowerCase();
        setIsAdmin(isUserAdmin);
        console.log("👑 Is Admin:", isUserAdmin);
      } catch (err) {
        console.warn("⚠️ Could not fetch admin address:", err);
        console.log(
          "This might happen if contract methods aren't accessible yet"
        );
        setIsAdmin(false);
      }

      // Test a simple call to verify contract is working
      try {
        const electionCount = await contractInstance.methods
          .electionCount()
          .call();
        console.log("🏛️ Election count:", Number(electionCount));
      } catch (err) {
        console.warn("⚠️ Could not fetch election count:", err);
      }

      setAccount(userAccount);
      setWeb3(web3Instance);
      setContract(contractInstance);
      setChainId(Number(networkId));

      localStorage.setItem("isWalletConnected", "true");

      console.log("✅ Wallet connected successfully!");
      console.log("📍 Account:", userAccount);
      console.log("🔗 Chain ID:", networkId);
      console.log("📄 Contract address:", CONTRACT_ADDRESS);
    } catch (error: any) {
      console.error("❌ Error connecting wallet:", error);
      const errorMsg =
        error.message || "Failed to connect wallet. Please try again.";
      setError(errorMsg);
      alert(errorMsg);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setWeb3(null);
    setContract(null);
    setChainId(null);
    setIsAdmin(false);
    setError(null);
    localStorage.removeItem("isWalletConnected");
  };

  useEffect(() => {
    const initWallet = async () => {
      const isConnected = localStorage.getItem("isWalletConnected");
      if (isConnected === "true" && typeof window.ethereum !== "undefined") {
        await connectWallet();
      }
    };

    initWallet();

    if (typeof window.ethereum !== "undefined") {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          connectWallet();
        } else {
          disconnectWallet();
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener(
            "accountsChanged",
            handleAccountsChanged
          );
          window.ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, []);

  return (
    <Web3Context.Provider
      value={{
        account,
        web3,
        contract,
        isConnected: !!account,
        isAdmin,
        connectWallet,
        disconnectWallet,
        chainId,
        error,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};
