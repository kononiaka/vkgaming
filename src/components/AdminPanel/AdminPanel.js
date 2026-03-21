import { useEffect, useState } from 'react';
import classes from './AdminPanel.module.css';

const AdminPanel = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                const data = await response.json();

                const usersList = Object.entries(data || {})
                    .map(([userId, userData]) => ({
                        userId,
                        nickname: userData.enteredNickname || userData.name || 'Unknown',
                        isAdmin: userData.isAdmin === true,
                        email: userData.email || 'N/A'
                    }))
                    .sort((a, b) => {
                        if (a.isAdmin && !b.isAdmin) {
                            return -1;
                        }
                        if (!a.isAdmin && b.isAdmin) {
                            return 1;
                        }
                        return a.nickname.localeCompare(b.nickname);
                    });

                setUsers(usersList);
            } catch (error) {
                console.error('Error fetching users:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const toggleAdminStatus = async (userId, currentStatus) => {
        try {
            const newStatus = !currentStatus;
            const response = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/isAdmin.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(newStatus),
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.ok) {
                // Update local state
                setUsers(users.map((u) => (u.userId === userId ? { ...u, isAdmin: newStatus } : u)));
                alert(
                    `Admin status ${newStatus ? 'granted' : 'revoked'} for ${users.find((u) => u.userId === userId).nickname}`
                );
            } else {
                alert('Failed to update admin status');
            }
        } catch (error) {
            console.error('Error updating admin status:', error);
            alert('Error updating admin status: ' + error.message);
        }
    };

    const filteredUsers = users.filter((user) => {
        if (filter === 'admins') {
            return user.isAdmin;
        }
        if (filter === 'users') {
            return !user.isAdmin;
        }
        return true;
    });

    if (loading) {
        return (
            <div className={classes.container}>
                <p>Loading users...</p>
            </div>
        );
    }

    return (
        <div className={classes.container}>
            <h1>👑 Admin Panel</h1>
            <p className={classes.subtitle}>Manage user permissions and admin roles</p>

            <div className={classes.filterButtons}>
                <button
                    className={`${classes.filterBtn} ${filter === 'all' ? classes.active : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All Users ({users.length})
                </button>
                <button
                    className={`${classes.filterBtn} ${filter === 'admins' ? classes.active : ''}`}
                    onClick={() => setFilter('admins')}
                >
                    Admins ({users.filter((u) => u.isAdmin).length})
                </button>
                <button
                    className={`${classes.filterBtn} ${filter === 'users' ? classes.active : ''}`}
                    onClick={() => setFilter('users')}
                >
                    Users ({users.filter((u) => !u.isAdmin).length})
                </button>
            </div>

            <div className={classes.usersTable}>
                {filteredUsers.length === 0 ? (
                    <p className={classes.noUsers}>No users found</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Nickname</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.userId} className={user.isAdmin ? classes.adminRow : ''}>
                                    <td className={classes.nickname}>
                                        {user.isAdmin && <span className={classes.adminBadge}>👑</span>}
                                        {user.nickname}
                                    </td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span
                                            className={`${classes.statusBadge} ${
                                                user.isAdmin ? classes.adminStatus : classes.userStatus
                                            }`}
                                        >
                                            {user.isAdmin ? 'Admin' : 'User'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => toggleAdminStatus(user.userId, user.isAdmin)}
                                            className={`${classes.actionBtn} ${
                                                user.isAdmin ? classes.revokeBtn : classes.grantBtn
                                            }`}
                                        >
                                            {user.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
