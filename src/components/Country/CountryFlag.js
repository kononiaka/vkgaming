import { getCountryLabel, resolveCountryCode } from '../../utils/country';
import classes from './CountryFlag.module.css';

const CountryFlag = ({ code, showLabel = false, size = 20, className = '' }) => {
    const normalized = resolveCountryCode({ countryCode: code });

    if (!normalized) {
        return null;
    }

    const label = getCountryLabel(normalized);

    return (
        <span
            className={`${classes.flag} ${className}`.trim()}
            title={label}
            aria-label={label}
            role="img"
        >
            <span
                className={`fi fi-${normalized.toLowerCase()} ${classes.icon}`}
                style={{ fontSize: `${size}px` }}
                aria-hidden="true"
            />
            {showLabel && <span className={classes.label}>{label}</span>}
        </span>
    );
};

export default CountryFlag;
