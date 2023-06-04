// export const TournamentBracket = (maxPlayers) => {
//     // const maxPlayers = 8; // Maximum number of players
//     const stages = ['1/4', '1/2', 'Third Place', 'Final', 'Winner']; // Bracket stages

//     // Determine the number of matches and teams for each stage
//     const matchesPerStage = [maxPlayers / 2, maxPlayers / 4, 2, 1];
//     const teamsPerMatch = [2, 2, 2, 2];

//     // console.log(stages);

//     // Create an array of matches for each stage
//     const brackets = stages.map((stage, index) => {
//         const numMatches = matchesPerStage[index];
//         const numTeams = teamsPerMatch[index];

//         return Array.from({ length: numMatches }, (_, matchIndex) => ({
//             stage,
//             matchIndex,
//             teams: Array.from({ length: numTeams }, (__, teamIndex) => ({
//                 playerIndex: matchIndex * numTeams + teamIndex
//                 // name: players[matchIndex * numTeams + teamIndex]?.name || 'TBD'
//             }))
//         }));
//     });
// };

// export const checkRegisterUser = (authCtx, players) => {
//     console.log('players', players);
//     let { userNickName } = authCtx;
//     console.log(userNickName);

//     return true;
// };
