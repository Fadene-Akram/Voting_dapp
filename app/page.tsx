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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface Election {
  id: number;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  candidates: string[];
  totalVotes: number;
  isEligible: boolean;
  hasVoted: boolean;
  results?: number[];
}

export default function Home() {
  const { account, contract, isConnected, connectWallet } = useWeb3();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(false);
  const [votingFor, setVotingFor] = useState<number | null>(null);

  const loadElections = async () => {
    if (!contract || !account) return;

    setLoading(true);
    try {
      const count = await contract.methods.electionCount().call();
      const electionList: Election[] = [];

      for (let i = 0; i < Number(count); i++) {
        const electionData = await contract.methods.getElection(i).call();
        const isEligible = await contract.methods
          .isEligibleVoter(i, account)
          .call();
        const hasVoted = await contract.methods.hasVoted(i, account).call();

        const election: Election = {
          id: i,
          title: electionData.title,
          description: electionData.description,
          startTime: Number(electionData.startTime),
          endTime: Number(electionData.endTime),
          isActive: electionData.isActive,
          candidates: electionData.candidates,
          totalVotes: Number(electionData.totalVotes),
          isEligible,
          hasVoted,
        };

        const now = Math.floor(Date.now() / 1000);
        if (!election.isActive || now > election.endTime) {
          const results = await contract.methods.getResults(i).call();
          election.results = results.map((r: string) => Number(r));
        }

        electionList.push(election);
      }

      setElections(electionList);
    } catch (error) {
      console.error("Error loading elections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (electionId: number, candidateIndex: number) => {
    if (!contract || !account) return;

    setVotingFor(candidateIndex);
    try {
      await contract.methods
        .vote(electionId, candidateIndex)
        .send({ from: account });
      await loadElections();
    } catch (error: any) {
      console.error("Voting error:", error);
    } finally {
      setVotingFor(null);
    }
  };

  const getElectionStatus = (election: Election) => {
    const now = Math.floor(Date.now() / 1000);
    const isOngoing =
      election.isActive && now >= election.startTime && now <= election.endTime;
    const hasEnded = !election.isActive || now > election.endTime;

    if (isOngoing) return { text: "Active", variant: "default" as const };
    if (hasEnded) return { text: "Ended", variant: "secondary" as const };
    return { text: "Upcoming", variant: "outline" as const };
  };

  useEffect(() => {
    if (isConnected && contract) {
      loadElections();
    }
  }, [isConnected, contract, account]);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
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
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <CardTitle className="text-3xl">Blockchain Voting</CardTitle>
            <CardDescription className="text-base">
              Secure, transparent, and decentralized elections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <div className="mt-0.5 text-green-600">
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
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Cryptographically Secured
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your vote is protected by blockchain technology
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <div className="mt-0.5 text-blue-600">
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
                      d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Transparent Results</p>
                  <p className="text-xs text-muted-foreground">
                    All votes are verifiable on the blockchain
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <div className="mt-0.5 text-purple-600">
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
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Immutable Records</p>
                  <p className="text-xs text-muted-foreground">
                    Votes cannot be changed or deleted
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button onClick={connectWallet} className="w-full" size="lg">
              Connect Wallet
            </Button>
            <Link href="/admin" className="w-full">
              <Button variant="ghost" className="w-full">
                Admin Login
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
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold">Voting Portal</h1>
              <p className="text-xs text-muted-foreground">
                Decentralized Elections
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="hidden md:flex">
              {account?.substring(0, 6)}...{account?.substring(38)}
            </Badge>
            <Link href="/admin">
              <Button variant="default">Admin Panel</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Elections
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4 text-muted-foreground"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{elections.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4 text-muted-foreground"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {elections.reduce((sum, e) => sum + e.totalVotes, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Elections
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4 text-muted-foreground"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {elections.filter((e) => e.isActive).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-sm text-muted-foreground">
              Loading elections...
            </p>
          </div>
        ) : elections.length === 0 ? (
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
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                />
              </svg>
              <p className="mt-4 text-lg font-medium">No elections available</p>
              <p className="text-sm text-muted-foreground">
                Check back later for new elections
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {elections.map((election) => {
              const status = getElectionStatus(election);
              const now = Math.floor(Date.now() / 1000);
              const isOngoing =
                election.isActive &&
                now >= election.startTime &&
                now <= election.endTime;
              const hasEnded = !election.isActive || now > election.endTime;
              const notStarted = now < election.startTime;

              return (
                <Card key={election.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle>{election.title}</CardTitle>
                          <Badge variant={status.variant}>{status.text}</Badge>
                        </div>
                        <CardDescription>
                          {election.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 pt-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>
                          Starts:{" "}
                          {new Date(election.startTime * 1000).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>
                          Ends:{" "}
                          {new Date(election.endTime * 1000).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-primary">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                          />
                        </svg>
                        <span>{election.totalVotes} votes</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!election.isEligible ? (
                      <Alert variant="destructive">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                          />
                        </svg>
                        <AlertTitle>Not Eligible</AlertTitle>
                        <AlertDescription>
                          You are not registered to vote in this election
                        </AlertDescription>
                      </Alert>
                    ) : election.hasVoted ? (
                      <Alert>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <AlertTitle>Vote Recorded</AlertTitle>
                        <AlertDescription>
                          Your vote has been successfully recorded on the
                          blockchain
                        </AlertDescription>
                      </Alert>
                    ) : notStarted ? (
                      <Alert>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <AlertTitle>Coming Soon</AlertTitle>
                        <AlertDescription>
                          This election will open for voting soon
                        </AlertDescription>
                      </Alert>
                    ) : hasEnded ? (
                      <Alert>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                          />
                        </svg>
                        <AlertTitle>Election Closed</AlertTitle>
                        <AlertDescription>
                          Voting for this election has ended
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-3">
                        <h3 className="font-semibold">Cast Your Vote</h3>
                        <div className="space-y-2">
                          {election.candidates.map((candidate, idx) => (
                            <Button
                              key={idx}
                              onClick={() => handleVote(election.id, idx)}
                              disabled={votingFor !== null}
                              variant="outline"
                              className="w-full justify-start text-left h-auto py-4"
                            >
                              <Avatar className="mr-3 h-10 w-10">
                                <AvatarFallback>
                                  {candidate.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1 font-medium">
                                {candidate}
                              </span>
                              {votingFor === idx && (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {election.results && hasEnded && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <h3 className="font-semibold">Final Results</h3>
                          <div className="space-y-4">
                            {election.candidates.map((candidate, idx) => {
                              const percentage =
                                election.totalVotes > 0
                                  ? (election.results![idx] /
                                      election.totalVotes) *
                                    100
                                  : 0;
                              const isWinner =
                                election.results![idx] ===
                                Math.max(...election.results!);

                              return (
                                <div key={idx} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {candidate}
                                      </span>
                                      {isWinner && (
                                        <Badge
                                          variant="default"
                                          className="bg-yellow-500"
                                        >
                                          Winner
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                      {election.results![idx]} votes (
                                      {percentage.toFixed(1)}%)
                                    </span>
                                  </div>
                                  <Progress
                                    value={percentage}
                                    className="h-2"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
