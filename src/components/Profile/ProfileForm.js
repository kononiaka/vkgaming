import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../../store/auth-context';

import classes from './ProfileForm.module.css';

const ProfileForm = () => {
    const newPasswordInsertedRef = useRef();
    const authCtx = useContext(AuthContext);
    const [playerScores, setPlayerScore] = useState([]);

    let { userNickName } = authCtx;
    userNickName = localStorage.getItem('userName');
    // console.log('User Profile userNickName', userNickName);
    useEffect(() => {
        const fetchPlayerScore = async () => {
            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                if (!response.ok) {
                    throw new Error('Unable to fetch data from the server.');
                }
                const data = await response.json();
                const filteredScores = Object.entries(data)
                    .filter(([id, player]) => player.enteredNickname === userNickName) // filter by entered nickname
                    .map(([id, player]) => ({
                        id,
                        enteredNickname: player.enteredNickname,
                        score: player.score
                    }));
                if (filteredScores.length > 0) {
                    const playerScore = filteredScores[0].score;
                    authCtx.score = playerScore;
                    console.log('playerScore', playerScore);
                    console.log('authCtx', authCtx);
                    setPlayerScore(playerScore);
                } else {
                    setPlayerScore(null);
                }
            } catch (error) {
                console.error(error);
            }
        };
        fetchPlayerScore();
    }, [authCtx]);

    const navigate = useNavigate();

    const submitHandler = (event) => {
        event.preventDefault();
        const newPasswordValue = newPasswordInsertedRef.current.value;

        fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key=AIzaSyD0B7Cgft2m58MjUWhIzjykJwkvnXN1O2k', {
            method: 'POST',
            body: JSON.stringify({
                idToken: authCtx.token,
                password: newPasswordValue,
                returnSecureToken: false
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(async (res) => {
                if (res.ok) {
                    navigate.replace('/');
                    return res.json();
                } else {
                    const data = await res.json();
                    console.log('ERROR', data.error);
                    let errorMessage = 'Custom error';
                    if (data && data.error && data.error.message) {
                        errorMessage = data.error.message;
                    }
                    throw new Error(errorMessage);
                }
            })
            .catch((err) => {
                alert(err.message);
            });
    };

    return (
        <>
            <p>Your score: {playerScores}</p>
            <form className={classes.form} onSubmit={submitHandler}>
                <div className={classes.control}>
                    <label htmlFor="new-password">New Password</label>
                    <input type="password" id="new-password" ref={newPasswordInsertedRef} />
                </div>
                <div className={classes.action}>
                    <button>Change Password</button>
                </div>
            </form>
        </>
    );
};

export default ProfileForm;
