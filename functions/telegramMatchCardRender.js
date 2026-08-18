const fs = require('fs');
const path = require('path');

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const ASSETS_DIR = path.join(__dirname, 'assets');
const FONT_BOLD_PATH = path.join(ASSETS_DIR, 'fonts', 'Inter-Bold.woff');
const FONT_SEMI_PATH = path.join(ASSETS_DIR, 'fonts', 'Inter-SemiBold.woff');
const CREST_PATH = path.join(ASSETS_DIR, 'images', 'konoplay-crest.png');
const RATINGS_DIR = path.join(ASSETS_DIR, 'images', 'ratings');

const TWITCH_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#bf94ff" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>';
const YOUTUBE_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ff4d6d" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>';

let fontCache = null;
let crestDataUriCache = null;
const starDataUriCache = {};

function loadFonts() {
    if (fontCache) {
        return fontCache;
    }
    const bold = fs.readFileSync(FONT_BOLD_PATH);
    const semi = fs.readFileSync(FONT_SEMI_PATH);
    fontCache = [
        { name: 'Inter', data: bold, weight: 700, style: 'normal' },
        { name: 'Inter', data: semi, weight: 600, style: 'normal' }
    ];
    return fontCache;
}

function getCrestDataUri() {
    if (crestDataUriCache) {
        return crestDataUriCache;
    }
    const buf = fs.readFileSync(CREST_PATH);
    crestDataUriCache = `data:image/png;base64,${buf.toString('base64')}`;
    return crestDataUriCache;
}

function svgDataUri(svg) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function normalizeStars(value) {
    if (value == null || value === '' || value === '-') {
        return 0;
    }
    if (typeof value === 'string' && value.includes(',')) {
        return Number(value.split(',').at(-1).trim()) || 0;
    }
    return Number(value) || 0;
}

function getStarImage(stars) {
    const value = normalizeStars(stars);
    const allowed = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    if (!allowed.includes(value)) {
        return null;
    }
    const key = String(value);
    if (starDataUriCache[key]) {
        return starDataUriCache[key];
    }
    const filePath = path.join(RATINGS_DIR, `${key}.png`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const buf = fs.readFileSync(filePath);
    const naturalWidth = buf.readUInt32BE(16);
    const naturalHeight = buf.readUInt32BE(20);
    const height = 26;
    const width = Math.max(18, Math.round((naturalWidth * height) / Math.max(naturalHeight, 1)));
    starDataUriCache[key] = {
        src: `data:image/png;base64,${buf.toString('base64')}`,
        width,
        height
    };
    return starDataUriCache[key];
}

function el(type, props = {}, ...children) {
    const flat = children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false);
    return {
        type,
        props: {
            ...props,
            children: flat.length <= 1 ? flat[0] ?? '' : flat
        }
    };
}

function truncateName(name, max = 18) {
    const value = String(name || 'TBD').trim() || 'TBD';
    if (value.length <= max) {
        return value;
    }
    return `${value.slice(0, max - 1)}…`;
}

function formatSeriesScoreLabel(pair = {}) {
    const score1 = Number(pair.score1) || 0;
    const score2 = Number(pair.score2) || 0;
    const type = pair.type === 'bo-5' ? 'BO5' : pair.type === 'bo-3' ? 'BO3' : pair.type === 'bo-2' ? 'BO2' : 'BO1';
    return { scoreText: `${score1} : ${score2}`, seriesType: type };
}

function initialFor(name) {
    return (
        String(name || '?')
            .trim()
            .charAt(0)
            .toUpperCase() || '?'
    );
}

function buildBannerLabel({ tournamentName, stageLabel, tournamentType }) {
    const parts = [tournamentName, stageLabel || tournamentType].filter(Boolean);
    return truncateName(parts.join(' · ').toUpperCase(), 48);
}

function streamBadgeIcon(src, active) {
    return el(
        'div',
        {
            style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 6,
                background: active ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)',
                opacity: active ? 1 : 0.45
            }
        },
        el('img', {
            src,
            width: 18,
            height: 18,
            style: { width: 18, height: 18 }
        })
    );
}

function streamBadges({ hasTwitch, hasYoutube }) {
    // Always show Twitch + YouTube slots above avatars (Match Center positions);
    // dim when the player has not linked that platform.
    return el(
        'div',
        {
            style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 30
            }
        },
        streamBadgeIcon(svgDataUri(TWITCH_ICON_SVG), Boolean(hasTwitch)),
        streamBadgeIcon(svgDataUri(YOUTUBE_ICON_SVG), Boolean(hasYoutube))
    );
}

function playerColumn({
    name,
    avatarDataUri,
    isWinner,
    stars = 0,
    hasTwitch = false,
    hasYoutube = false,
    flagDataUri = null
}) {
    const starImage = getStarImage(stars);
    const avatarBorder = isWinner ? '3px solid #f5c400' : '2px solid rgba(255,255,255,0.2)';

    const portrait = el(
        'div',
        {
            style: {
                display: 'flex',
                position: 'relative',
                width: 120,
                height: 120,
                alignItems: 'center',
                justifyContent: 'center'
            }
        },
        avatarDataUri
            ? el('img', {
                  src: avatarDataUri,
                  width: 112,
                  height: 112,
                  style: {
                      width: 112,
                      height: 112,
                      borderRadius: 14,
                      objectFit: 'cover',
                      border: avatarBorder
                  }
              })
            : el(
                  'div',
                  {
                      style: {
                          width: 112,
                          height: 112,
                          borderRadius: 14,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(255,255,255,0.08)',
                          border: avatarBorder,
                          color: '#f8f4ea',
                          fontSize: 44,
                          fontWeight: 700
                      }
                  },
                  initialFor(name)
              ),
        starImage
            ? el(
                  'div',
                  {
                      style: {
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: -4,
                          width: 120,
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center'
                      }
                  },
                  el('img', {
                      src: starImage.src,
                      width: starImage.width,
                      height: starImage.height,
                      style: {
                          width: starImage.width,
                          height: starImage.height,
                          objectFit: 'contain'
                      }
                  })
              )
            : null
    );

    return el(
        'div',
        {
            style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 320,
                gap: 8
            }
        },
        streamBadges({ hasTwitch, hasYoutube }),
        portrait,
        flagDataUri
            ? el('img', {
                  src: flagDataUri,
                  width: 28,
                  height: 20,
                  style: {
                      width: 28,
                      height: 20,
                      borderRadius: 3,
                      objectFit: 'cover',
                      marginTop: 6
                  }
              })
            : el('div', { style: { display: 'flex', width: 28, height: 20, marginTop: 6 } }, ''),
        el(
            'div',
            {
                style: {
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%',
                    color: isWinner ? '#f5c400' : '#f8f4ea',
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    lineHeight: 1.15
                }
            },
            truncateName(name, 18).toUpperCase()
        ),
        isWinner
            ? el(
                  'div',
                  {
                      style: {
                          display: 'flex',
                          justifyContent: 'center',
                          color: '#f5c400',
                          fontSize: 14,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: 'uppercase'
                      }
                  },
                  'WINNER'
              )
            : el('div', { style: { display: 'flex', height: 18 } }, '')
    );
}

function formatScheduleLabel(iso) {
    if (!iso) {
        return 'TBD';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return 'TBD';
    }
    return date.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Kyiv'
    });
}

function statusMeta(status) {
    switch (status) {
        case 'Registration Started':
            return { badge: 'OPEN', title: 'Registration open', color: '#3d8bfd' };
        case 'Registration finished!':
            return { badge: 'CLOSED', title: 'Registration closed', color: '#8a7a5a' };
        case 'Tournament Finished':
            return { badge: 'FINISHED', title: 'Tournament finished', color: '#f5c400' };
        default:
            return { badge: 'UPDATE', title: 'Tournament update', color: '#9146ff' };
    }
}

function cardTypeMeta(cardType) {
    switch (cardType) {
        case 'live':
            return { badge: 'LIVE', badgeBg: 'rgba(199, 92, 92, 0.92)' };
        case 'schedule':
            return { badge: 'UPCOMING', badgeBg: '#9146ff' };
        case 'result':
        default:
            return { badge: 'RESULT', badgeBg: 'rgba(199, 92, 92, 0.92)' };
    }
}

function buildMatchArenaCardTree(data) {
    const {
        cardType = 'result',
        tournamentName = 'Tournament',
        stageLabel = 'Match',
        tournamentType = null,
        team1 = 'TBD',
        team2 = 'TBD',
        winner = '',
        pair = {},
        team1AvatarDataUri = null,
        team2AvatarDataUri = null,
        team1Stars = 0,
        team2Stars = 0,
        team1HasTwitch = false,
        team2HasTwitch = false,
        team1HasYoutube = false,
        team2HasYoutube = false,
        team1FlagDataUri = null,
        team2FlagDataUri = null,
        castle1 = null,
        castle2 = null,
        scheduledAt = null
    } = data;

    const { scoreText, seriesType } = formatSeriesScoreLabel(pair);
    const team1Wins = cardType === 'result' && Boolean(winner && winner === team1);
    const team2Wins = cardType === 'result' && Boolean(winner && winner === team2);
    const crest = getCrestDataUri();
    const banner = buildBannerLabel({ tournamentName, stageLabel, tournamentType });
    const typeMeta = cardTypeMeta(cardType);

    let centerPillText = scoreText;
    let centerPillBg = 'linear-gradient(180deg, #c75c5c 0%, #a63f3f 100%)';
    let centerPillColor = '#fff';
    let centerSubline = `Heroes 3 · ${seriesType}`;

    if (cardType === 'schedule') {
        centerPillText = formatScheduleLabel(scheduledAt || pair.scheduledAt);
        centerPillBg = 'linear-gradient(180deg, #ffd95a 0%, #f5c400 100%)';
        centerPillColor = '#1a1200';
        centerSubline = `Heroes 3 · ${seriesType}`;
    } else if (cardType === 'live' && castle1 && castle2) {
        centerSubline = `${truncateName(castle1, 16)} vs ${truncateName(castle2, 16)}`;
    }

    return el(
        'div',
        {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                position: 'relative',
                background: '#121826',
                color: '#f8f4ea',
                fontFamily: 'Inter',
                border: '3px solid rgba(245, 196, 0, 0.55)',
                borderRadius: 18,
                overflow: 'hidden'
            }
        },
        el('div', {
            style: {
                position: 'absolute',
                top: 90,
                left: 110,
                width: 980,
                height: 420,
                border: '1px solid rgba(201, 162, 39, 0.35)',
                transform: 'rotate(45deg)',
                borderRadius: 4
            }
        }),
        el(
            'div',
            {
                style: {
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    padding: '28px 36px 24px',
                    alignItems: 'center'
                }
            },
            el(
                'div',
                {
                    style: {
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 18
                    }
                },
                el(
                    'div',
                    {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px 14px',
                            borderRadius: 8,
                            background: typeMeta.badgeBg,
                            color: '#fff',
                            fontSize: 16,
                            fontWeight: 800,
                            letterSpacing: 1.5,
                            textTransform: 'uppercase'
                        }
                    },
                    typeMeta.badge
                ),
                el(
                    'div',
                    {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 420,
                            maxWidth: 720,
                            padding: '10px 22px',
                            borderRadius: 10,
                            background: 'linear-gradient(180deg, #ffd95a 0%, #f5c400 100%)',
                            color: '#1a1200',
                            fontSize: 18,
                            fontWeight: 800,
                            letterSpacing: 1,
                            textAlign: 'center'
                        }
                    },
                    banner
                ),
                el('div', { style: { display: 'flex', width: 88 } }, '')
            ),
            el(
                'div',
                {
                    style: {
                        display: 'flex',
                        width: '100%',
                        flexGrow: 1,
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }
                },
                playerColumn({
                    name: team1,
                    avatarDataUri: team1AvatarDataUri,
                    isWinner: team1Wins,
                    stars: team1Stars,
                    hasTwitch: team1HasTwitch,
                    hasYoutube: team1HasYoutube,
                    flagDataUri: team1FlagDataUri
                }),
                el(
                    'div',
                    {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            width: 320,
                            minWidth: 320
                        }
                    },
                    el('img', {
                        src: crest,
                        width: 240,
                        height: 240,
                        style: {
                            width: 240,
                            height: 240,
                            objectFit: 'contain',
                            display: 'flex'
                        }
                    }),
                    el(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 140,
                                maxWidth: 300,
                                padding: '10px 18px',
                                borderRadius: 10,
                                background: centerPillBg,
                                color: centerPillColor,
                                fontSize: cardType === 'schedule' ? 22 : 34,
                                fontWeight: 800,
                                letterSpacing: 1,
                                textAlign: 'center'
                            }
                        },
                        centerPillText
                    ),
                    el(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                color: 'rgba(248,244,234,0.62)',
                                fontSize: 18,
                                fontWeight: 600,
                                letterSpacing: 1,
                                textAlign: 'center',
                                maxWidth: 300,
                                justifyContent: 'center'
                            }
                        },
                        centerSubline
                    )
                ),
                playerColumn({
                    name: team2,
                    avatarDataUri: team2AvatarDataUri,
                    isWinner: team2Wins,
                    stars: team2Stars,
                    hasTwitch: team2HasTwitch,
                    hasYoutube: team2HasYoutube,
                    flagDataUri: team2FlagDataUri
                })
            )
        )
    );
}

function statusBadgeEl(meta) {
    return el(
        'div',
        {
            style: {
                display: 'flex',
                padding: '8px 16px',
                borderRadius: 8,
                background: meta.color,
                color: meta.color === '#f5c400' ? '#1a1200' : '#fff',
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: 2
            }
        },
        meta.badge
    );
}

function placeBadgeEl(place, color) {
    return el(
        'div',
        {
            style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 52,
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${color}`,
                background: 'rgba(201, 162, 39, 0.12)',
                color,
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 0.5
            }
        },
        place || ''
    );
}

function winnerAvatarEl(entry) {
    const size = 72;
    const border = `3px solid ${entry.color || '#f5c400'}`;
    const starImage = getStarImage(entry.stars);
    const portrait = entry.avatarDataUri
        ? el('img', {
              src: entry.avatarDataUri,
              width: size,
              height: size,
              style: {
                  width: size,
                  height: size,
                  borderRadius: 12,
                  objectFit: 'cover',
                  border
              }
          })
        : el(
              'div',
              {
                  style: {
                      width: size,
                      height: size,
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.08)',
                      border,
                      color: '#f8f4ea',
                      fontSize: 26,
                      fontWeight: 700
                  }
              },
              initialFor(entry.name)
          );

    return el(
        'div',
        {
            style: {
                display: 'flex',
                position: 'relative',
                width: size + 8,
                height: size + 10,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }
        },
        portrait,
        starImage
            ? el(
                  'div',
                  {
                      style: {
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: -2,
                          width: size + 8,
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center'
                      }
                  },
                  el('img', {
                      src: starImage.src,
                      width: starImage.width,
                      height: starImage.height,
                      style: {
                          width: starImage.width,
                          height: starImage.height,
                          objectFit: 'contain'
                      }
                  })
              )
            : null
    );
}

function winnerRowEl(entry) {
    return el(
        'div',
        {
            style: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'rgba(255,255,255,0.08)',
                borderLeftWidth: 3,
                borderLeftStyle: 'solid',
                borderLeftColor: entry.color
            }
        },
        placeBadgeEl(entry.place || entry.label, entry.color),
        winnerAvatarEl(entry),
        el(
            'div',
            {
                style: {
                    display: 'flex',
                    flex: 1,
                    minWidth: 0,
                    color: '#f8f4ea',
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: 1.2
                }
            },
            truncateName(entry.name, 16)
        )
    );
}

function buildStatusCardTree(data) {
    const {
        tournamentName = 'Tournament',
        tournamentDate = '',
        status = 'Registration Started',
        winners = [],
        prizePoolUsd = 0
    } = data;
    const meta = statusMeta(status);
    const crest = getCrestDataUri();
    const isFinished = status === 'Tournament Finished';
    const prizeLabel =
        Number(prizePoolUsd) > 0 ? `Prize pool · $${Number(prizePoolUsd).toFixed(2)}` : null;
    const podium = Array.isArray(winners)
        ? winners
              .slice(0, 3)
              .map((entry) => {
                  if (typeof entry === 'string') {
                      return {
                      label: '',
                      place: '',
                      color: '#f8f4ea',
                      name: entry,
                      avatarDataUri: null,
                      stars: 0
                  };
              }
              return {
                  label: entry.label || '',
                  place: entry.place || '',
                  color: entry.color || '#f8f4ea',
                  name: entry.name || '',
                  avatarDataUri: entry.avatarDataUri || null,
                  stars: entry.stars || 0
              };
              })
              .filter((entry) => entry.name)
        : [];

    if (isFinished) {
        const crestSize = 330;
        return el(
            'div',
            {
                style: {
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#121826',
                    color: '#f8f4ea',
                    fontFamily: 'Inter',
                    border: '3px solid rgba(245, 196, 0, 0.55)',
                    borderRadius: 18,
                    padding: '22px 28px',
                    gap: 16
                }
            },
            el(
                'div',
                {
                    style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        flexShrink: 0,
                        width: 360
                    }
                },
                statusBadgeEl(meta),
                el('img', {
                    src: crest,
                    width: crestSize,
                    height: crestSize,
                    style: { width: crestSize, height: crestSize, objectFit: 'contain' }
                })
            ),
            el(
                'div',
                {
                    style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 14,
                        flex: 1,
                        minWidth: 0,
                        padding: '0 8px'
                    }
                },
                el(
                    'div',
                    {
                        style: {
                            display: 'flex',
                            fontSize: 36,
                            fontWeight: 800,
                            textAlign: 'center',
                            maxWidth: 420
                        }
                    },
                    truncateName(tournamentName, 36)
                ),
                el(
                    'div',
                    {
                        style: {
                            display: 'flex',
                            fontSize: 22,
                            fontWeight: 600,
                            color: 'rgba(248,244,234,0.75)'
                        }
                    },
                    meta.title
                ),
                prizeLabel
                    ? el(
                          'div',
                          {
                              style: {
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '8px 18px',
                                  borderRadius: 10,
                                  background: 'rgba(245, 196, 0, 0.14)',
                                  border: '1px solid rgba(245, 196, 0, 0.45)',
                                  color: '#f5c400',
                                  fontSize: 20,
                                  fontWeight: 800,
                                  letterSpacing: 0.5
                              }
                          },
                          prizeLabel
                      )
                    : null
            ),
            podium.length
                ? el(
                      'div',
                      {
                          style: {
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'stretch',
                              justifyContent: 'center',
                              gap: 10,
                              flexShrink: 0,
                              width: 340
                          }
                      },
                      ...podium.map((entry) => winnerRowEl(entry))
                  )
                : el('div', { style: { display: 'flex', width: 340 } }, '')
        );
    }

    return el(
        'div',
        {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#121826',
                color: '#f8f4ea',
                fontFamily: 'Inter',
                border: '3px solid rgba(245, 196, 0, 0.55)',
                borderRadius: 18,
                padding: '40px 48px',
                gap: 18
            }
        },
        statusBadgeEl(meta),
        el('img', {
            src: crest,
            width: 220,
            height: 220,
            style: { width: 220, height: 220, objectFit: 'contain' }
        }),
        el(
            'div',
            {
                style: {
                    display: 'flex',
                    fontSize: 40,
                    fontWeight: 800,
                    textAlign: 'center',
                    maxWidth: 900
                }
            },
            truncateName(tournamentName, 42)
        ),
        el(
            'div',
            {
                style: {
                    display: 'flex',
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'rgba(248,244,234,0.75)'
                }
            },
            meta.title
        ),
        tournamentDate
            ? el(
                  'div',
                  {
                      style: {
                          display: 'flex',
                          fontSize: 20,
                          color: 'rgba(248,244,234,0.55)'
                      }
                  },
                  truncateName(String(tournamentDate), 40)
              )
            : null
    );
}

function buildDigestCardTree(data) {
    const { slot = 'morning', dateKey = '', matches = [] } = data;
    const crest = getCrestDataUri();
    const badge = slot === 'evening' ? 'EVENING' : 'MORNING';
    const rows = (matches || []).slice(0, 7);

    return el(
        'div',
        {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: '#121826',
                color: '#f8f4ea',
                fontFamily: 'Inter',
                border: '3px solid rgba(245, 196, 0, 0.55)',
                borderRadius: 18,
                padding: '32px 40px',
                gap: 16
            }
        },
        el(
            'div',
            {
                style: {
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }
            },
            el(
                'div',
                {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14
                    }
                },
                el('img', {
                    src: crest,
                    width: 64,
                    height: 64,
                    style: { width: 64, height: 64, objectFit: 'contain' }
                }),
                el(
                    'div',
                    {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4
                        }
                    },
                    el(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                fontSize: 28,
                                fontWeight: 800,
                                color: '#f5c400',
                                letterSpacing: 1
                            }
                        },
                        'KONOPLAY'
                    ),
                    el(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                fontSize: 18,
                                color: 'rgba(248,244,234,0.7)'
                            }
                        },
                        dateKey || 'Today'
                    )
                )
            ),
            el(
                'div',
                {
                    style: {
                        display: 'flex',
                        padding: '8px 14px',
                        borderRadius: 8,
                        background: '#9146ff',
                        color: '#fff',
                        fontSize: 16,
                        fontWeight: 800,
                        letterSpacing: 1.5
                    }
                },
                `${badge} DIGEST`
            )
        ),
        el(
            'div',
            {
                style: {
                    display: 'flex',
                    fontSize: 26,
                    fontWeight: 700,
                    marginTop: 4
                }
            },
            `Today's matches · ${rows.length}`
        ),
        el(
            'div',
            {
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    marginTop: 8,
                    width: '100%'
                }
            },
            ...rows.map((row) =>
                el(
                    'div',
                    {
                        style: {
                            display: 'flex',
                            width: '100%',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(245,196,0,0.18)'
                        }
                    },
                    el(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                color: '#f5c400',
                                fontSize: 20,
                                fontWeight: 800,
                                width: 70
                            }
                        },
                        row.timeLabel || '—'
                    ),
                    el(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                flexGrow: 1,
                                fontSize: 20,
                                fontWeight: 700,
                                paddingLeft: 12,
                                paddingRight: 12
                            }
                        },
                        `${truncateName(row.team1, 14)} vs ${truncateName(row.team2, 14)}`
                    ),
                    el(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                fontSize: 16,
                                color: 'rgba(248,244,234,0.55)',
                                maxWidth: 280
                            }
                        },
                        truncateName(row.tournamentName, 22)
                    )
                )
            )
        )
    );
}

function buildResultCardTree(data) {
    return buildMatchArenaCardTree({ ...data, cardType: 'result' });
}

function buildCardTree(data = {}) {
    const cardType = String(data.cardType || 'result').toLowerCase();
    if (cardType === 'status') {
        return buildStatusCardTree(data);
    }
    if (cardType === 'digest') {
        return buildDigestCardTree(data);
    }
    if (cardType === 'live' || cardType === 'schedule' || cardType === 'result') {
        return buildMatchArenaCardTree({ ...data, cardType });
    }
    return buildMatchArenaCardTree({ ...data, cardType: 'result' });
}

async function renderTelegramCard(data) {
    const satori = require('satori').default;
    const { Resvg } = require('@resvg/resvg-js');
    const fonts = loadFonts();
    const tree = buildCardTree(data);
    const svg = await satori(tree, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts
    });
    const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: CARD_WIDTH }
    });
    return Buffer.from(resvg.render().asPng());
}

async function renderResultCard(data) {
    return renderTelegramCard({ ...data, cardType: 'result' });
}

module.exports = {
    CARD_WIDTH,
    CARD_HEIGHT,
    renderResultCard,
    renderTelegramCard,
    buildResultCardTree,
    buildCardTree,
    formatSeriesScoreLabel,
    truncateName,
    normalizeStars,
    buildBannerLabel
};
