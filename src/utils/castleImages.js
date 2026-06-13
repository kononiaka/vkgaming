import castleImg from '../image/castles/castle.jpeg';
import rampartImg from '../image/castles/rampart.jpeg';
import towerImg from '../image/castles/tower.jpeg';
import infernoImg from '../image/castles/inferno.jpeg';
import necropolisImg from '../image/castles/necropolis.jpeg';
import dungeonImg from '../image/castles/dungeon.jpeg';
import strongholdImg from '../image/castles/stronghold.jpeg';
import fortressImg from '../image/castles/fortress.jpeg';
import confluxImg from '../image/castles/conflux.jpeg';
import coveImg from '../image/castles/cove.jpeg';
import factoryImg from '../image/castles/factory.jpeg';
import kronverkImg from '../image/castles/kronverk.jpeg';

const CASTLE_IMAGE_MAP = {
    castle: castleImg,
    rampart: rampartImg,
    tower: towerImg,
    inferno: infernoImg,
    necropolis: necropolisImg,
    dungeon: dungeonImg,
    stronghold: strongholdImg,
    fortress: fortressImg,
    conflux: confluxImg,
    cove: coveImg,
    factory: factoryImg,
    kronverk: kronverkImg
};

export const getCastleImage = (castleName) => {
    const normalizedName = String(castleName || '')
        .split('-')[0]
        .trim()
        .toLowerCase();

    return CASTLE_IMAGE_MAP[normalizedName] || null;
};
