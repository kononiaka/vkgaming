/**
 * Coin Transaction Management
 *
 * This module handles all coin transactions including:
 * - Adding coins (rewards, donations, etc.)
 * - Deducting coins (tournament creation, purchases, etc.)
 * - Logging transaction history
 */

/**
 * Log a coin transaction to the database
 * @param {string} userId - User ID
 * @param {number} amount - Amount of coins (positive for add, negative for deduct)
 * @param {string} type - Transaction type (e.g., 'tournament_creation', 'reward', 'donation')
 * @param {string} description - Transaction description
 * @param {object} metadata - Additional transaction metadata
 * @returns {Promise<boolean>} Success status
 */
export const logCoinTransaction = async (userId, amount, type, description, metadata = {}) => {
    try {
        const transaction = {
            userId,
            amount,
            type,
            description,
            metadata,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };

        const response = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/coinTransactions.json`,
            {
                method: 'POST',
                body: JSON.stringify(transaction),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.ok) {
            console.log(
                `Coin transaction logged: ${amount} coins ${amount > 0 ? 'added to' : 'deducted from'} user ${userId}`
            );
            return true;
        } else {
            console.error('Failed to log coin transaction:', await response.text());
            return false;
        }
    } catch (error) {
        console.error('Error logging coin transaction:', error);
        return false;
    }
};

/**
 * Add coins to user's account and log the transaction
 * @param {string} userId - User ID
 * @param {number} amount - Amount of coins to add
 * @param {string} type - Transaction type
 * @param {string} description - Transaction description
 * @param {object} metadata - Additional metadata
 * @returns {Promise<{success: boolean, newBalance: number}>}
 */
export const addCoins = async (userId, amount, type, description, metadata = {}) => {
    try {
        // Get current user data
        const userResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`
        );
        const userData = await userResponse.json();

        const currentCoins = userData.coins || 0;
        const newCoins = currentCoins + amount;

        // Update user's coins
        const updateResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/coins.json`,
            {
                method: 'PUT',
                body: JSON.stringify(newCoins),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (updateResponse.ok) {
            // Log the transaction
            await logCoinTransaction(userId, amount, type, description, {
                ...metadata,
                previousBalance: currentCoins,
                newBalance: newCoins
            });

            console.log(`Added ${amount} coins. Previous: ${currentCoins}, New: ${newCoins}`);
            return { success: true, newBalance: newCoins };
        } else {
            console.error('Failed to add coins:', await updateResponse.text());
            return { success: false, newBalance: currentCoins };
        }
    } catch (error) {
        console.error('Error adding coins:', error);
        return { success: false, newBalance: 0 };
    }
};

/**
 * Deduct coins from user's account and log the transaction
 * @param {string} userId - User ID
 * @param {number} amount - Amount of coins to deduct
 * @param {string} type - Transaction type
 * @param {string} description - Transaction description
 * @param {object} metadata - Additional metadata
 * @returns {Promise<{success: boolean, newBalance: number}>}
 */
export const deductCoins = async (userId, amount, type, description, metadata = {}) => {
    try {
        // Get current user data
        const userResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`
        );
        const userData = await userResponse.json();

        const currentCoins = userData.coins || 0;

        // Check if user has enough coins
        if (currentCoins < amount) {
            console.error(`Insufficient coins. Required: ${amount}, Available: ${currentCoins}`);
            return { success: false, newBalance: currentCoins, error: 'Insufficient coins' };
        }

        const newCoins = currentCoins - amount;

        // Update user's coins
        const updateResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/coins.json`,
            {
                method: 'PUT',
                body: JSON.stringify(newCoins),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (updateResponse.ok) {
            // Log the transaction (negative amount for deduction)
            await logCoinTransaction(userId, -amount, type, description, {
                ...metadata,
                previousBalance: currentCoins,
                newBalance: newCoins
            });

            console.log(`Deducted ${amount} coins. Previous: ${currentCoins}, New: ${newCoins}`);
            return { success: true, newBalance: newCoins };
        } else {
            console.error('Failed to deduct coins:', await updateResponse.text());
            return { success: false, newBalance: currentCoins };
        }
    } catch (error) {
        console.error('Error deducting coins:', error);
        return { success: false, newBalance: 0 };
    }
};

/**
 * Get user's coin transaction history
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of transactions
 */
export const getCoinTransactionHistory = async (userId) => {
    try {
        const response = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/coinTransactions.json`
        );
        const data = await response.json();

        if (!data) {
            return [];
        }

        // Convert object to array and sort by timestamp (newest first)
        const transactions = Object.entries(data)
            .map(([id, transaction]) => ({ id, ...transaction }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return transactions;
    } catch (error) {
        console.error('Error fetching coin transaction history:', error);
        return [];
    }
};

/**
 * Get user's current coin balance
 * @param {string} userId - User ID
 * @returns {Promise<number>} Current coin balance
 */
export const getCoinBalance = async (userId) => {
    try {
        const response = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/coins.json`
        );
        const coins = await response.json();
        return coins || 0;
    } catch (error) {
        console.error('Error fetching coin balance:', error);
        return 0;
    }
};
