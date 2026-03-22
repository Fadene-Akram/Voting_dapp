// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VotingSystem {
    address public admin;
    
    struct Election {
        uint256 id;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        string[] candidates;
        mapping(address => bool) hasVoted;
        mapping(address => bool) isEligible;
        mapping(uint256 => uint256) votes; // candidateIndex => voteCount
        uint256 totalVotes;
    }
    
    mapping(uint256 => Election) public elections;
    uint256 public electionCount;
    
    event ElectionCreated(uint256 indexed electionId, string title, uint256 startTime, uint256 endTime);
    event VoterRegistered(uint256 indexed electionId, address indexed voter);
    event VoteCasted(uint256 indexed electionId, address indexed voter);
    event ElectionEnded(uint256 indexed electionId);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier electionExists(uint256 _electionId) {
        require(_electionId < electionCount, "Election does not exist");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    // Admin creates a new election
    function createElection(
        string memory _title,
        string memory _description,
        string[] memory _candidates,
        uint256 _startTime,
        uint256 _endTime
    ) public onlyAdmin returns (uint256) {
        require(_candidates.length >= 2, "Need at least 2 candidates");
        require(_startTime < _endTime, "Invalid time range");
        require(_endTime > block.timestamp, "End time must be in future");
        
        uint256 electionId = electionCount;
        Election storage newElection = elections[electionId];
        
        newElection.id = electionId;
        newElection.title = _title;
        newElection.description = _description;
        newElection.startTime = _startTime;
        newElection.endTime = _endTime;
        newElection.isActive = true;
        newElection.candidates = _candidates;
        newElection.totalVotes = 0;
        
        electionCount++;
        
        emit ElectionCreated(electionId, _title, _startTime, _endTime);
        return electionId;
    }
    
    // Admin registers eligible voters
    function registerVoters(uint256 _electionId, address[] memory _voters) 
        public 
        onlyAdmin 
        electionExists(_electionId) 
    {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");
        
        for (uint256 i = 0; i < _voters.length; i++) {
            election.isEligible[_voters[i]] = true;
            emit VoterRegistered(_electionId, _voters[i]);
        }
    }
    
    // Admin can remove voter eligibility
    function removeVoter(uint256 _electionId, address _voter) 
        public 
        onlyAdmin 
        electionExists(_electionId) 
    {
        Election storage election = elections[_electionId];
        election.isEligible[_voter] = false;
    }
    
    // User casts a vote
    function vote(uint256 _electionId, uint256 _candidateIndex) 
        public 
        electionExists(_electionId) 
    {
        Election storage election = elections[_electionId];
        
        require(election.isActive, "Election is not active");
        require(block.timestamp >= election.startTime, "Election has not started");
        require(block.timestamp <= election.endTime, "Election has ended");
        require(election.isEligible[msg.sender], "You are not eligible to vote");
        require(!election.hasVoted[msg.sender], "You have already voted");
        require(_candidateIndex < election.candidates.length, "Invalid candidate");
        
        election.hasVoted[msg.sender] = true;
        election.votes[_candidateIndex]++;
        election.totalVotes++;
        
        emit VoteCasted(_electionId, msg.sender);
    }
    
    // Admin ends election manually

    function endElection(uint256 _electionId)
            public 
            onlyAdmin 
            electionExists(_electionId) 
        {
            Election storage election = elections[_electionId];
            require(election.isActive, "Election already ended");
            
            election.isActive = false;
            emit ElectionEnded(_electionId);
        }
        
        // Get election details
        function getElection(uint256 _electionId) 
            public 
            view 
            electionExists(_electionId) 
            returns (
                string memory title,
                string memory description,
                uint256 startTime,
                uint256 endTime,
                bool isActive,
                string[] memory candidates,
                uint256 totalVotes
            ) 
        {
            Election storage election = elections[_electionId];
            return (
                election.title,
                election.description,
                election.startTime,
                election.endTime,
                election.isActive,
                election.candidates,
                election.totalVotes
            );
        }
        
        // Get results for an election
        function getResults(uint256 _electionId) 
            public 
            view 
            electionExists(_electionId) 
            returns (uint256[] memory) 
        {
            Election storage election = elections[_electionId];
            uint256[] memory results = new uint256[](election.candidates.length);
            
            for (uint256 i = 0; i < election.candidates.length; i++) {
                results[i] = election.votes[i];
            }
            
            return results;
        }
        
        // Check if address is eligible to vote
        function isEligibleVoter(uint256 _electionId, address _voter) 
            public 
            view 
            electionExists(_electionId) 
            returns (bool) 
        {
            return elections[_electionId].isEligible[_voter];
        }
        
        // Check if address has voted
        function hasVoted(uint256 _electionId, address _voter) 
            public 
            view 
            electionExists(_electionId) 
            returns (bool) 
        {
            return elections[_electionId].hasVoted[_voter];
        }
        
        // Get all active elections
        function getActiveElections() public view returns (uint256[] memory) {
            uint256 activeCount = 0;
            
            for (uint256 i = 0; i < electionCount; i++) {
                if (
                    elections[i].isActive && 
                    block.timestamp >= elections[i].startTime && 
                    block.timestamp <= elections[i].endTime
                ) {
                    activeCount++;
                }
            }
            
            uint256[] memory activeElections = new uint256[](activeCount);
            uint256 index = 0;
            
            for (uint256 i = 0; i < electionCount; i++) {
                if (
                    elections[i].isActive && 
                    block.timestamp >= elections[i].startTime && 
                    block.timestamp <= elections[i].endTime
                ) {
                    activeElections[index] = i;
                    index++;
                }
            }
            
            return activeElections;
        }
        
        // Transfer admin rights
        function transferAdmin(address _newAdmin) public onlyAdmin {
            require(_newAdmin != address(0), "Invalid address");
            admin = _newAdmin;
        }
    }