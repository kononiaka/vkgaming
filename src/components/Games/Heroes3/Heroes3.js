import { FIREBASE_DATABASE_URL } from '../../../config/firebase';
import { useEffect, useMemo, useState } from 'react';

import classes from './Heroes3.module.css';

const Heroes3Games = () => {
    let [games, setGames] = useState([]);
    const [sortBy, setSortBy] = useState('date-desc');
    const [searchPlayer, setSearchPlayer] = useState('');
    const [searchTournament, setSearchTournament] = useState('');
    const [tournamentSuggestions, setTournamentSuggestions] = useState([]);
    const [activeTournamentIndex, setActiveTournamentIndex] = useState(-1);
    const [isLoaded, setIsLoaded] = useState(false);

    const formatGameType = (gameType) => {
        const normalized = String(gameType ?? '')
            .toLowerCase()
            .trim();

        if (normalized === '5' || normalized === 'bo5' || normalized === 'bo-5') {
            return 'bo-5';
        }

        if (normalized === '1' || normalized === 'bo1' || normalized === 'bo-1') {
            return 'bo-1';
        }

        if (normalized === '3' || normalized === 'bo3' || normalized === 'bo-3') {
            return 'bo-3';
        }

        return gameType;
    };

    useEffect(() => {
        const fetchGamesList = async () => {
            try {
                const response = await fetch(
                    `${FIREBASE_DATABASE_URL}/games/heroes3.json`
                );
                const data = await response.json();

                if (data) {
                    games = Object.entries(data).map(([id, game]) => ({
                        id: id,
                        date: game.date,
                        gameName: game.gameName,
                        gameType: game.gameType,
                        tournamentName: game.tournamentName,
                        stage: game.stage,
                        opponent1: game.opponent1,
                        opponent1Castle: game.opponent1Castle,
                        opponent2: game.opponent2,
                        opponent2Castle: game.opponent2Castle,
                        score: game.score,
                        winner: game.winner
                    }));

                    setGames(games);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoaded(true);
            }
        };

        fetchGamesList();
    }, []);

    const tournamentGames = games.filter(
        (game) => typeof game.tournamentName === 'string' && game.tournamentName.trim() !== ''
    );

    const uniqueTournamentNames = useMemo(() => {
        const names = tournamentGames.map((game) => game.tournamentName.trim());
        return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    }, [tournamentGames]);

    const updateTournamentSuggestions = (value) => {
        const query = value.trim().toLowerCase();
        const matches = query
            ? uniqueTournamentNames.filter((name) => name.toLowerCase().includes(query))
            : uniqueTournamentNames;
        setTournamentSuggestions(matches.slice(0, 12));
        setActiveTournamentIndex(-1);
    };

    const handleTournamentChange = (value) => {
        setSearchTournament(value);
        updateTournamentSuggestions(value);
    };

    const selectTournament = (name) => {
        setSearchTournament(name);
        setTournamentSuggestions([]);
        setActiveTournamentIndex(-1);
    };

    const filteredGames = tournamentGames.filter((game) => {
        const tournamentQuery = searchTournament.trim().toLowerCase();
        if (tournamentQuery && !game.tournamentName.toLowerCase().includes(tournamentQuery)) {
            return false;
        }

        const playerQuery = searchPlayer.trim().toLowerCase();
        if (!playerQuery) {
            return true;
        }

        return (
            (game.opponent1 || '').toLowerCase().includes(playerQuery) ||
            (game.opponent2 || '').toLowerCase().includes(playerQuery)
        );
    });

    const sortedGames = [...filteredGames].sort((a, b) => {
        if (sortBy === 'date-desc') {
            return new Date(b.date) - new Date(a.date);
        } else if (sortBy === 'date-asc') {
            return new Date(a.date) - new Date(b.date);
        }
        return 0;
    });

    return (
        <div className={`${classes.gamesContainer} data-page`}>
            <h2 className={classes.pageTitle}>Tournament match log</h2>
            <p className={classes.pageSubtitle}>
                Cup and bracket matches reported on konoplay. For ranked lobby history and meta stats, see{' '}
                <a href="https://hotameta.com/" target="_blank" rel="noopener noreferrer">
                    HotA Meta
                </a>
                .
            </p>
            {!isLoaded ? (
                <p className={classes.loading}>Loading matches...</p>
            ) : tournamentGames.length === 0 ? (
                <p className={classes.loading}>No tournament matches reported yet.</p>
            ) : (
                <>
                    <div className={classes.controls}>
                        <div className={classes.searchBox}>
                            <label className={classes.controlLabel} htmlFor="games-search-tournament">
                                Tournament name
                            </label>
                            <div className={classes.combobox}>
                                <input
                                    id="games-search-tournament"
                                    type="text"
                                    className={classes.searchInput}
                                    placeholder="Type to filter..."
                                    value={searchTournament}
                                    onChange={(e) => handleTournamentChange(e.target.value)}
                                    onFocus={() => updateTournamentSuggestions(searchTournament)}
                                    onBlur={() => {
                                        setTimeout(() => setTournamentSuggestions([]), 150);
                                    }}
                                    onKeyDown={(e) => {
                                        if (!tournamentSuggestions.length) {
                                            return;
                                        }
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setActiveTournamentIndex((prev) =>
                                                prev < tournamentSuggestions.length - 1 ? prev + 1 : 0
                                            );
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setActiveTournamentIndex((prev) =>
                                                prev > 0 ? prev - 1 : tournamentSuggestions.length - 1
                                            );
                                        } else if (e.key === 'Enter' && activeTournamentIndex >= 0) {
                                            e.preventDefault();
                                            selectTournament(tournamentSuggestions[activeTournamentIndex]);
                                        } else if (e.key === 'Escape') {
                                            setTournamentSuggestions([]);
                                            setActiveTournamentIndex(-1);
                                        }
                                    }}
                                    autoComplete="off"
                                />
                                {tournamentSuggestions.length > 0 && (
                                    <ul className={classes.suggestionsList} role="listbox">
                                        {tournamentSuggestions.map((name, index) => (
                                            <li key={name} role="option" aria-selected={index === activeTournamentIndex}>
                                                <button
                                                    type="button"
                                                    className={`${classes.suggestionItem} ${
                                                        index === activeTournamentIndex ? classes.suggestionActive : ''
                                                    }`}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectTournament(name);
                                                    }}
                                                    onMouseEnter={() => setActiveTournamentIndex(index)}
                                                >
                                                    {name}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                        <div className={classes.searchBox}>
                            <label className={classes.controlLabel} htmlFor="games-search-player">
                                Search player
                            </label>
                            <input
                                id="games-search-player"
                                type="text"
                                className={classes.searchInput}
                                placeholder="Player name..."
                                value={searchPlayer}
                                onChange={(e) => setSearchPlayer(e.target.value)}
                            />
                        </div>
                        <div className={classes.sortBox}>
                            <label className={classes.controlLabel} htmlFor="games-sort">
                                Sort by
                            </label>
                            <select
                                id="games-sort"
                                className={classes.sortSelect}
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="date-desc">Date (newest first)</option>
                                <option value="date-asc">Date (oldest first)</option>
                            </select>
                        </div>
                    </div>
                    {sortedGames.length === 0 && (
                        <p className={classes.noResults}>No matches match your filters.</p>
                    )}
                    <div className={classes.gamesList}>
                        {sortedGames.map((game) => (
                            <div key={game.id} className={classes.gameCard}>
                                <div className={classes.gameHeader}>
                                    <span className={classes.gameDate}>{game.date}</span>
                                    {game.gameType && (
                                        <span className={classes.gameType}>{formatGameType(game.gameType)}</span>
                                    )}
                                </div>
                                {(game.tournamentName || game.stage) && (
                                    <div className={classes.tournamentInfo}>
                                        {game.tournamentName && (
                                            <span className={classes.tournamentName}>{game.tournamentName}</span>
                                        )}
                                        {game.stage && <span className={classes.stage}>{game.stage}</span>}
                                    </div>
                                )}
                                <div className={classes.matchup}>
                                    <div
                                        className={`${classes.player} ${game.winner === game.opponent1 ? classes.winnerPlayer : ''}`}
                                    >
                                        <div className={classes.playerName}>{game.opponent1}</div>
                                        {game.opponent1Castle && (
                                            <div className={classes.castle}>{game.opponent1Castle}</div>
                                        )}
                                    </div>
                                    <div className={classes.vs}>VS</div>
                                    <div
                                        className={`${classes.player} ${game.winner === game.opponent2 ? classes.winnerPlayer : ''}`}
                                    >
                                        <div className={classes.playerName}>{game.opponent2}</div>
                                        {game.opponent2Castle && (
                                            <div className={classes.castle}>{game.opponent2Castle}</div>
                                        )}
                                    </div>
                                </div>
                                {game.score && <div className={classes.score}>Score: {game.score}</div>}
                                {game.winner && <div className={classes.winner}>Winner: {game.winner}</div>}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default Heroes3Games;
