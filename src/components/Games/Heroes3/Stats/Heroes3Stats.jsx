import { useEffect, useState } from 'react';

const Heroes3Stats = () => {
    let [castles, setCastles] = useState([]);

    useEffect(() => {
        // Fetch Heroes 3 games from database
        const fetchCastlesList = async () => {
            try {
                const response = await fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/statistic/heroes3/castles.json'
                );
                const data = await response.json();

                castles = Object.entries(data).map(([id, castle]) => ({
                    id: id,
                    name: id,
                    win: castle.win,
                    lose: castle.lose,
                    total: castle.total,
                    rate: castle.total !== 0 ? (castle.win / castle.total) * 100 : 0
                }));

                castles.sort((a, b) => b.rate - a.rate);

                setCastles(castles);
            } catch (error) {
                console.error(error);
            }
        };

        fetchCastlesList();
    }, []);

    const getRows = () => {
        const rows = [];
        for (let i = 0; i < castles.length; i++) {
            const castleRows = castles[i];
            // console.log('castleRows', castleRows);
            const castleName = castleRows ? castleRows.name : '-';
            // console.log('castleName', castleName);
            const castleTotal = castleRows ? castleRows.total : '-';
            const castleWin = castleRows ? castleRows.win : '-';
            const castleLose = castleRows ? castleRows.lose : '-';
            const castleRate = castleTotal ? `${(castleWin / castleTotal) * 100} %` : '-';

            // console.log('castleRate', castleRate);
            rows.push(
                <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{castleName}</td>
                    <td>{castleTotal}</td>
                    <td>{castleWin}</td>
                    <td>{castleLose}</td>
                    <td>{castleRate}</td>
                </tr>
            );
        }
        return rows;
    };
    return (
        <div>
            <h2>Leaderboard</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Name</th>
                        <th>Total Games</th>
                        <th>Wins</th>
                        <th>Loses</th>
                        <th>Rate</th>
                    </tr>
                </thead>
                <tbody>{getRows()}</tbody>
            </table>
        </div>
    );
};

export default Heroes3Stats;
