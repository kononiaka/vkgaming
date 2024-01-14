import React from 'react';
import halfStar from '../../image/ratings/0.5.png';
import oneAndHalfStar from '../../image/ratings/1.5.png';
import oneStar from '../../image/ratings/1.png';
import twoAndHalfStar from '../../image/ratings/2.5.png';
import twoStar from '../../image/ratings/2.png';
import threeAndHalfStar from '../../image/ratings/3.5.png';
import threeStar from '../../image/ratings/3.png';
import fourAndHalfStar from '../../image/ratings/4.5.png';
import fourStar from '../../image/ratings/4.png';
import fiveStar from '../../image/ratings/5.png';

// import { getStarImageFilename } from '../../api';

const getStarImageFilename = (stars) => {
    switch (stars) {
        case 0.5:
            return halfStar;
        case 1:
            return oneStar;
        case 1.5:
            return oneAndHalfStar;
        case 2:
            return twoStar;
        case 2.5:
            return twoAndHalfStar;
        case 3:
            return threeStar;
        case 3.5:
            return threeAndHalfStar;
        case 4:
            return fourStar;
        case 4.5:
            return fourAndHalfStar;
        case 5:
            return fiveStar;
        default:
            return null; // Return null for other cases or handle as needed
    }
};

const StarsComponent = ({ stars }) => (
    <>{stars !== '-' && <img src={getStarImageFilename(stars)} alt={`Stars: ${stars}`} style={{ height: '30px' }} />}</>
);

export default StarsComponent;
