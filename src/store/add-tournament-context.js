import { createContext, useContext } from 'react';

const AddTournamentContext = createContext(null);

export const useAddTournament = () => {
    const ctx = useContext(AddTournamentContext);
    if (!ctx) {
        return {
            openAddTournament: () => {},
            refreshAddTournamentState: () => {},
            isAddTournamentDisabled: true,
            addTournamentHint: '',
            userCoins: null
        };
    }
    return ctx;
};

export default AddTournamentContext;
