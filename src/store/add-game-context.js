import { createContext, useContext } from 'react';

const AddGameContext = createContext(null);

export const useAddGame = () => {
    const ctx = useContext(AddGameContext);
    if (!ctx) {
        return {
            openAddGame: () => {}
        };
    }
    return ctx;
};

export default AddGameContext;
