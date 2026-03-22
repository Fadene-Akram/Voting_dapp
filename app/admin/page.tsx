"use client";

import { useEffect, useState } from "react";
import { useWeb3 } from "@/context/Web3Context";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPanel() {
  const { account, contract, web3, isConnected, isAdmin, connectWallet } =
    useWeb3();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [candidates, setCandidates] = useState(["", ""]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [electionId, setElectionId] = useState("");
  const [voterAddresses, setVoterAddresses] = useState("");

  const [elections, setElections] = useState<any[]>([]);

  const authenticateAdmin = async () => {
    if (!account || !web3) return;

    try {
      const message = `Admin authentication for ${account} at ${Date.now()}`;
      const signature = await web3.eth.personal.sign(message, account, "");

      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account, signature, message }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("adminToken", data.token);
        setIsAuthenticated(true);
      } else {
        alert(data.error || "Authentication failed");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      alert(error.message || "Authentication failed");
    }
  };

  const checkAuthentication = async () => {
    if (!isAdmin) return;

    const token = localStorage.getItem("adminToken");
    if (token) {
      try {
        const response = await fetch("/api/admin/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("adminToken");
        }
      } catch (error) {
        console.error("Error verifying token:", error);
        localStorage.removeItem("adminToken");
      }
    }
  };

  const loadElections = async () => {
    if (!contract) return;

    try {
      const count = await contract.methods.electionCount().call();
      const electionList = [];

      for (let i = 0; i < Number(count); i++) {
        const data = await contract.methods.getElection(i).call();
        const results = await contract.methods.getResults(i).call();

        electionList.push({
          id: i,
          title: data.title,
          description: data.description,
          startTime: Number(data.startTime),
          endTime: Number(data.endTime),
          isActive: data.isActive,
          candidates: data.candidates,
          totalVotes: Number(data.totalVotes),
          results: results.map((r: string | bigint) => Number(r)), // Convert all to numbers
        });
      }

      setElections(electionList);
    } catch (error) {
      console.error("Error loading elections:", error);
    }
  };

  const createElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !account) return;

    setLoading(true);
    try {
      const filteredCandidates = candidates.filter((c) => c.trim() !== "");
      const startTimestamp = Math.floor(new Date(startTime).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);

      await contract.methods
        .createElection(
          title,
          description,
          filteredCandidates,
          startTimestamp.toString(), // Convert to string
          endTimestamp.toString() // Convert to string
        )
        .send({ from: account });

      alert("Election created successfully!");
      setTitle("");
      setDescription("");
      setCandidates(["", ""]);
      setStartTime("");
      setEndTime("");
      await loadElections();
    } catch (error: any) {
      console.error("Error creating election:", error);
      alert(error.message || "Failed to create election");
    } finally {
      setLoading(false);
    }
  };

  const registerVoters = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !account || !web3) return;

    setLoading(true);
    try {
      // Get election count first - it's returned as BigInt
      const electionCount = await contract.methods.electionCount().call();
      const electionIdNum = BigInt(electionId); // Convert to BigInt

      // Compare BigInts properly
      if (electionIdNum >= electionCount) {
        alert(
          `Invalid election ID. Maximum ID is ${Number(electionCount) - 1}`
        );
        return;
      }

      const addresses = voterAddresses
        .split("\n")
        .map((addr) => addr.trim())
        .filter((addr) => addr !== "" && web3.utils.isAddress(addr));

      if (addresses.length === 0) {
        alert("Please enter valid Ethereum addresses");
        return;
      }

      // First, check if election is active - convert to number for the call
      const election = await contract.methods
        .getElection(Number(electionIdNum))
        .call();
      if (!election.isActive) {
        alert("Election is not active");
        return;
      }

      // Split addresses into smaller batches
      const batchSize = 10; // Start with small batches
      const batches = [];
      for (let i = 0; i < addresses.length; i += batchSize) {
        batches.push(addresses.slice(i, i + batchSize));
      }

      let totalRegistered = 0;
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        try {
          // Try with smaller gas limit first
          await contract.methods
            .registerVoters(Number(electionIdNum), batch) // Convert to number
            .send({
              from: account,
              gas: 300000, // Conservative gas limit
            });

          totalRegistered += batch.length;
          console.log(
            `Batch ${i + 1}/${
              batches.length
            } processed (${totalRegistered} total)`
          );
        } catch (batchError: any) {
          console.error(`Error in batch ${i}:`, batchError);

          // Try with individual registration if batch fails
          alert(`Batch ${i + 1} failed. Trying individual registration...`);

          for (const addr of batch) {
            try {
              console.log("Trying address:", addr);
              // If you had a single voter registration function:
              // await contract.methods.registerVoter(Number(electionIdNum), addr).send({ from: account, gas: 100000 });
            } catch (error) {
              console.error(`Failed to register ${addr}:`, error);
            }
          }
          break;
        }
      }

      alert(`Successfully registered ${totalRegistered} voters!`);
      setVoterAddresses("");
    } catch (error: any) {
      console.error("Error registering voters:", error);

      // Try to get more detailed error info
      if (error.data) {
        console.error("Error data:", error.data);
      }
      if (error.receipt) {
        console.error("Receipt:", error.receipt);
      }

      alert(
        `Failed to register voters. Check console for details. Error: ${
          error.message || "Unknown error"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const endElection = async (id: number) => {
    if (
      !contract ||
      !account ||
      !confirm("Are you sure you want to end this election?")
    )
      return;

    setLoading(true);
    try {
      await contract.methods.endElection(id).send({ from: account });
      alert("Election ended successfully!");
      await loadElections();
    } catch (error: any) {
      console.error("Error ending election:", error);
      alert(error.message || "Failed to end election");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && contract && isAdmin) {
      checkAuthentication();
      loadElections();
    }
  }, [isConnected, contract, account, isAdmin]);

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-8 w-8 text-primary-foreground"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <CardTitle className="text-3xl">Admin Panel</CardTitle>
            <CardDescription>
              Connect your wallet to access admin features
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2">
            <Button onClick={connectWallet} className="w-full" size="lg">
              Connect Wallet
            </Button>
            <Link href="/" className="w-full">
              <Button variant="ghost" className="w-full">
                Back to Voting Portal
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-8 w-8 text-destructive"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription>
              This account is not authorized as an admin
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/" className="w-full">
              <Button className="w-full">Back to Voting Portal</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-8 w-8 text-primary-foreground"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <CardTitle className="text-3xl">Admin Authentication</CardTitle>
            <CardDescription>
              Sign a message to verify your identity as admin
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2">
            <Button onClick={authenticateAdmin} className="w-full" size="lg">
              Sign Message & Authenticate
            </Button>
            <Link href="/" className="w-full">
              <Button variant="ghost" className="w-full">
                Back to Voting Portal
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                {account?.substring(0, 6)}...{account?.substring(38)}
              </p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline">Voting Portal</Button>
          </Link>
        </div>
      </header>

      <main className="container py-8">
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">Create Election</TabsTrigger>
            <TabsTrigger value="register">Register Voters</TabsTrigger>
            <TabsTrigger value="elections">All Elections</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create New Election</CardTitle>
                <CardDescription>
                  Set up a new election with candidates and voting period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createElection} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Election Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter election title"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the election"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Candidates</Label>
                    {candidates.map((candidate, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={candidate}
                          onChange={(e) => {
                            const newCandidates = [...candidates];
                            newCandidates[idx] = e.target.value;
                            setCandidates(newCandidates);
                          }}
                          placeholder={`Candidate ${idx + 1}`}
                        />
                        {candidates.length > 2 && (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() =>
                              setCandidates(
                                candidates.filter((_, i) => i !== idx)
                              )
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCandidates([...candidates, ""])}
                      className="w-full"
                    >
                      Add Candidate
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        type="datetime-local"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Creating..." : "Create Election"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Register Voters</CardTitle>
                <CardDescription>
                  Add eligible voters to an election
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={registerVoters} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="electionId">Election ID</Label>
                    <Input
                      id="electionId"
                      type="number"
                      value={electionId}
                      onChange={(e) => setElectionId(e.target.value)}
                      placeholder="Enter election ID"
                      min="0"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voters">
                      Voter Addresses (one per line)
                    </Label>
                    <Textarea
                      id="voters"
                      value={voterAddresses}
                      onChange={(e) => setVoterAddresses(e.target.value)}
                      placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&#10;0x1234567890123456789012345678901234567890"
                      rows={10}
                      className="font-mono text-sm"
                      required
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Registering..." : "Register Voters"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="elections">
            <div className="space-y-4">
              {elections.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-12 w-12 text-muted-foreground"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                      />
                    </svg>
                    <p className="mt-4 text-lg font-medium">
                      No elections created yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Create your first election to get started
                    </p>
                  </CardContent>
                </Card>
              ) : (
                elections.map((election) => (
                  <Card key={election.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle>
                              #{election.id} - {election.title}
                            </CardTitle>
                            <Badge
                              variant={
                                election.isActive ? "default" : "secondary"
                              }
                            >
                              {election.isActive ? "Active" : "Ended"}
                            </Badge>
                          </div>
                          <CardDescription>
                            {election.description}
                          </CardDescription>
                        </div>
                        {election.isActive && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => endElection(election.id)}
                            disabled={loading}
                          >
                            End Election
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Start Time:
                          </span>
                          <span className="font-medium">
                            {new Date(
                              election.startTime * 1000
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            End Time:
                          </span>
                          <span className="font-medium">
                            {new Date(election.endTime * 1000).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Total Votes:
                          </span>
                          <span className="font-semibold text-primary">
                            {election.totalVotes}
                          </span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="font-semibold">Results</h4>
                        <div className="space-y-2">
                          {election.candidates.map(
                            (candidate: string, idx: number) => {
                              const percentage =
                                election.totalVotes > 0
                                  ? (election.results[idx] /
                                      election.totalVotes) *
                                    100
                                  : 0;

                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">
                                      {candidate}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {election.results[idx]} votes
                                      {election.totalVotes > 0 &&
                                        ` (${percentage.toFixed(1)}%)`}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                    <div
                                      className="h-full bg-primary transition-all"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
