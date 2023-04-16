import logo from "../../image/graf-logo-black-removebg.png";
import classes from './graf_banner.module.css';

// import { useMediaQuery } from 'react-responsive';

const GrafBanner = (props) => {
    // const isDesktopOrLaptop = useMediaQuery({
    //     query: '(min-width: 900px)'
    // });

    return (
        <a className={classes["footer-href"]} onClick={props.handleGrafClick}>
            <h6 className={classes["footer"]}>
                <span><img src={logo} alt={"logo"} />powered by </span>
                Graf Studio
            </h6>
        </a>
    );
};

export default GrafBanner;