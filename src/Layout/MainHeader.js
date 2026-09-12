import React, { useContext, useEffect, useState } from 'react';

import CartButton from '../UI/LoginBtn/CartButton';

import { Link, useLocation } from 'react-router-dom';

import AuthContext from '../store/auth-context';

import logoWordmark from '../image/konoplay-logo-new-invert.png';
import logoCrest from '../image/konoplay-crest.png';

import classes from './MainHeader.module.css';

const pathMatches = (pathname, prefixes) =>
    prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const MainHeader = () => {
    const authCtx = useContext(AuthContext);
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const path = location.pathname;

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        document.body.style.overflow = menuOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [menuOpen]);

    const closeMenu = () => setMenuOpen(false);
    const toggleMenu = () => setMenuOpen((open) => !open);

    const navClass = (prefixes) =>
        `${classes['navLink-link']}${pathMatches(path, prefixes) ? ` ${classes.navLinkActive}` : ''}`;

    return (
        <header className={classes.header}>
            <Link to="/" onClick={closeMenu} className={classes.logoLink} aria-label="Konoplay home">
                <img src={logoCrest} alt="" className={classes.logoCrest} />
                <span className={classes.logoCopy}>
                    <img src={logoWordmark} alt="Konoplay" className={classes.logoWordmark} />
                    <span className={classes['logo-credo']}>Play with us!</span>
                </span>
            </Link>

            <button
                type="button"
                className={`${classes.menuToggle} ${menuOpen ? classes.menuToggleOpen : ''}`}
                onClick={toggleMenu}
                aria-expanded={menuOpen}
                aria-controls="main-navigation"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
                <span className={classes.menuToggleBar} />
                <span className={classes.menuToggleBar} />
                <span className={classes.menuToggleBar} />
            </button>

            {menuOpen && (
                <button type="button" className={classes.menuBackdrop} onClick={closeMenu} aria-label="Close menu" />
            )}

            <nav id="main-navigation" className={`${classes.nav} ${menuOpen ? classes.navOpen : ''}`}>
                <ul className={classes.navLink}>
                    <li className={classes['navLink-item']}>
                        <Link
                            to="/tournaments/homm3"
                            className={navClass(['/tournaments', '/games'])}
                            onClick={closeMenu}
                            aria-current={pathMatches(path, ['/tournaments', '/games']) ? 'page' : undefined}
                        >
                            Tournaments
                        </Link>
                        <div className={classes['navLink-dropdown']}>
                            <Link
                                to="/tournaments/homm3"
                                className={classes['navLink-dropdown-item']}
                                onClick={closeMenu}
                            >
                                Heroes of Might & Magic III
                            </Link>
                            <Link to="/games/homm3" className={classes['navLink-dropdown-item']} onClick={closeMenu}>
                                Match log
                            </Link>
                            <Link
                                to="/games/homm3/statistics"
                                className={classes['navLink-dropdown-item']}
                                onClick={closeMenu}
                            >
                                Statistics
                            </Link>
                        </div>
                    </li>

                    <li className={classes['navLink-item']}>
                        <Link
                            to="/live"
                            className={navClass(['/live'])}
                            onClick={closeMenu}
                            aria-current={pathMatches(path, ['/live']) ? 'page' : undefined}
                        >
                            Live Arena
                        </Link>
                    </li>

                    <li className={classes['navLink-item']}>
                        <Link
                            to="/gazette"
                            className={navClass(['/gazette'])}
                            onClick={closeMenu}
                            aria-current={pathMatches(path, ['/gazette']) ? 'page' : undefined}
                        >
                            Gazette
                        </Link>
                    </li>

                    <li className={classes['navLink-item']}>
                        <Link
                            to="/leaderboard"
                            className={navClass(['/leaderboard'])}
                            onClick={closeMenu}
                            aria-current={pathMatches(path, ['/leaderboard']) ? 'page' : undefined}
                        >
                            Leaderboard
                        </Link>
                    </li>

                    <li className={classes['navLink-item']}>
                        <Link
                            to="/players"
                            className={navClass(['/players'])}
                            onClick={closeMenu}
                            aria-current={pathMatches(path, ['/players']) ? 'page' : undefined}
                        >
                            Players
                        </Link>
                    </li>

                    <li className={classes['navLink-item']}>
                        <Link
                            to="/rules"
                            className={navClass(['/rules'])}
                            onClick={closeMenu}
                            aria-current={pathMatches(path, ['/rules']) ? 'page' : undefined}
                        >
                            Rules
                        </Link>
                    </li>

                    <li className={classes['navLink-item']}>
                        <Link
                            to="/support"
                            className={navClass(['/support'])}
                            onClick={closeMenu}
                            aria-current={pathMatches(path, ['/support']) ? 'page' : undefined}
                        >
                            Support
                        </Link>
                    </li>

                    <li className={classes['navLink-item']}>
                        <Link
                            to="/help"
                            className={navClass(['/help'])}
                            onClick={closeMenu}
                            aria-current={pathMatches(path, ['/help']) ? 'page' : undefined}
                        >
                            Help
                        </Link>
                    </li>

                    <li className={classes['navLink-item-btn']}>
                        {authCtx.isLogged && authCtx.userNickName && (
                            <div className={classes['navLink-nickname']}>
                                <span className={classes.nicknameText}>{authCtx.userNickName}</span>
                            </div>
                        )}
                        <div className={classes['navLink-link']}>
                            <CartButton />
                        </div>
                    </li>
                </ul>
            </nav>
        </header>
    );
};

export default MainHeader;
