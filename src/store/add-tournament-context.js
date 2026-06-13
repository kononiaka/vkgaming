import { createContext, useContext } from 'react';

const AddTournamentContext = createContext(null);

export const useAddTournament = () => {
    const ctx = useContext(AddTournamentContext);
    if (!ctx) {
        return {
            openAddTournament: () => {},
            isAddTournamentDisabled: true,
            addTournamentHint: ''
        };
    }
    return ctx;
};

export default AddTournamentContext;
