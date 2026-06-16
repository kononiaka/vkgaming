const ISO_COUNTRY_CODES = [
    'AD',
    'AE',
    'AF',
    'AG',
    'AI',
    'AL',
    'AM',
    'AO',
    'AQ',
    'AR',
    'AS',
    'AT',
    'AU',
    'AW',
    'AX',
    'AZ',
    'BA',
    'BB',
    'BD',
    'BE',
    'BF',
    'BG',
    'BH',
    'BI',
    'BJ',
    'BL',
    'BM',
    'BN',
    'BO',
    'BQ',
    'BR',
    'BS',
    'BT',
    'BV',
    'BW',
    'BY',
    'BZ',
    'CA',
    'CC',
    'CD',
    'CF',
    'CG',
    'CH',
    'CI',
    'CK',
    'CL',
    'CM',
    'CN',
    'CO',
    'CR',
    'CU',
    'CV',
    'CW',
    'CX',
    'CY',
    'CZ',
    'DE',
    'DJ',
    'DK',
    'DM',
    'DO',
    'DZ',
    'EC',
    'EE',
    'EG',
    'EH',
    'ER',
    'ES',
    'ET',
    'FI',
    'FJ',
    'FK',
    'FM',
    'FO',
    'FR',
    'GA',
    'GB',
    'GD',
    'GE',
    'GF',
    'GG',
    'GH',
    'GI',
    'GL',
    'GM',
    'GN',
    'GP',
    'GQ',
    'GR',
    'GS',
    'GT',
    'GU',
    'GW',
    'GY',
    'HK',
    'HM',
    'HN',
    'HR',
    'HT',
    'HU',
    'ID',
    'IE',
    'IL',
    'IM',
    'IN',
    'IO',
    'IQ',
    'IR',
    'IS',
    'IT',
    'JE',
    'JM',
    'JO',
    'JP',
    'KE',
    'KG',
    'KH',
    'KI',
    'KM',
    'KN',
    'KP',
    'KR',
    'KW',
    'KY',
    'KZ',
    'LA',
    'LB',
    'LC',
    'LI',
    'LK',
    'LR',
    'LS',
    'LT',
    'LU',
    'LV',
    'LY',
    'MA',
    'MC',
    'MD',
    'ME',
    'MF',
    'MG',
    'MH',
    'MK',
    'ML',
    'MM',
    'MN',
    'MO',
    'MP',
    'MQ',
    'MR',
    'MS',
    'MT',
    'MU',
    'MV',
    'MW',
    'MX',
    'MY',
    'MZ',
    'NA',
    'NC',
    'NE',
    'NF',
    'NG',
    'NI',
    'NL',
    'NO',
    'NP',
    'NR',
    'NU',
    'NZ',
    'OM',
    'PA',
    'PE',
    'PF',
    'PG',
    'PH',
    'PK',
    'PL',
    'PM',
    'PN',
    'PR',
    'PS',
    'PT',
    'PW',
    'PY',
    'QA',
    'RE',
    'RO',
    'RS',
    'RU',
    'RW',
    'SA',
    'SB',
    'SC',
    'SD',
    'SE',
    'SG',
    'SH',
    'SI',
    'SJ',
    'SK',
    'SL',
    'SM',
    'SN',
    'SO',
    'SR',
    'SS',
    'ST',
    'SV',
    'SX',
    'SY',
    'SZ',
    'TC',
    'TD',
    'TF',
    'TG',
    'TH',
    'TJ',
    'TK',
    'TL',
    'TM',
    'TN',
    'TO',
    'TR',
    'TT',
    'TV',
    'TW',
    'TZ',
    'UA',
    'UG',
    'UM',
    'US',
    'UY',
    'UZ',
    'VA',
    'VC',
    'VE',
    'VG',
    'VI',
    'VN',
    'VU',
    'WF',
    'WS',
    'YE',
    'YT',
    'ZA',
    'ZM',
    'ZW'
];

const regionDisplayNames =
    typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

const buildCountryName = (code) => {
    const label = regionDisplayNames?.of(code);
    if (label && label !== code) {
        return label;
    }

    return code;
};

export const COUNTRY_OPTIONS = ISO_COUNTRY_CODES.map((code) => ({
    code,
    name: buildCountryName(code)
}))
    .filter((entry) => entry.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

const COUNTRY_NAME_BY_CODE = COUNTRY_OPTIONS.reduce((map, entry) => {
    map[entry.code] = entry.name;
    return map;
}, {});

export const resolveCountryCode = (user) => {
    const code = user?.countryCode;
    if (!code || typeof code !== 'string') {
        return null;
    }

    const normalized = code.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

export const buildCountryLookup = (usersData = {}) => {
    const byLowerNickname = {};

    Object.values(usersData).forEach((user) => {
        if (!user?.enteredNickname) {
            return;
        }

        const code = resolveCountryCode(user);
        if (code) {
            byLowerNickname[user.enteredNickname.trim().toLowerCase()] = code;
        }
    });

    return byLowerNickname;
};

export const lookupCountryCode = (nickname, lookup, playerRecord = null) => {
    const fromPlayer = resolveCountryCode(playerRecord);
    if (fromPlayer) {
        return fromPlayer;
    }

    if (!nickname) {
        return null;
    }

    return lookup[nickname.trim().toLowerCase()] || null;
};

export const getCountryLabel = (code) => {
    const normalized = resolveCountryCode({ countryCode: code });
    if (!normalized) {
        return '';
    }

    return COUNTRY_NAME_BY_CODE[normalized] || buildCountryName(normalized) || normalized;
};
