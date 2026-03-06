# Donation System Integration

## Overview
The donation system has been fully integrated with coin rewards to encourage community support and funding for tournament prize pools.

## Features

### 🎯 Donation Tiers
- **Supporter**: 10 UAH → +2 coins
- **Contributor**: 25 UAH → +5 coins
- **Champion**: 50 UAH → +10 coins
- **Legend**: 100 UAH → +25 coins

### 💰 Custom Donations
- Players can donate any amount
- Earn 1 coin for every 5 UAH donated
- Minimum donation: 1 UAH

### 🏆 Coin Rewards Integration
- All donations reward players with coins
- Transactions are logged in the coin transaction history
- Rewards are given immediately upon donation

### 📊 Donation Leaderboard (Optional)
- Component available: `DonationLeaderboard.js`
- Shows top 10 donors by total amount donated
- Displays donation count and coins earned

## Technical Implementation

### Files Modified
- `src/UI/modalDonate/modalDonate.js` - Enhanced with donation tiers and coin rewards
- `src/UI/modalDonate/modalDonate.module.css` - Added styles for new features
- `COIN_OPERATIONS_DOCUMENTATION.md` - Updated to include donation rewards

### New Components
- `src/components/DonationLeaderboard/DonationLeaderboard.js` - Optional leaderboard component
- `src/components/DonationLeaderboard/DonationLeaderboard.module.css` - Leaderboard styles

### Coin Transaction Types
- `donation_reward` - Used for all donation-related coin rewards

## Usage

### Basic Donation Flow
1. User clicks donate button in layout
2. Modal opens with donation options
3. User selects tier or enters custom amount
4. Upon clicking donate, coins are awarded immediately
5. Success notification shows reward amount

### Adding Donation Leaderboard
```jsx
import DonationLeaderboard from '../components/DonationLeaderboard/DonationLeaderboard';

// Add to any page/component
<DonationLeaderboard />
```

## Benefits

### For Players
- Earn coins for supporting the platform
- Higher donations = More coins
- Gamified giving experience

### For Platform
- Increased donations through coin incentives
- 80% of donations go to tournament prizes
- 20% supports platform development
- Full transaction tracking and audit trail

## Future Enhancements

### Potential Additions
- Monthly donation challenges
- Special donor badges/achievements
- Donation milestones with bonus rewards
- Integration with external payment processors
- Donation analytics dashboard

### Coin Reward Ideas
- First-time donor bonus (+3 coins)
- Monthly donor streak (+5 coins per month)
- Referral donations (bonus coins when friends donate)
- Tournament prize pool contributions (percentage-based rewards)

## Configuration

### Donation Tiers
Tiers can be modified in `modalDonate.js` in the `donationTiers` array:

```javascript
const donationTiers = [
    {
        amount: 10,
        coins: 2,
        label: 'Supporter',
        description: 'Basic support + 2 coins',
        color: '#4CAF50'
    },
    // ... more tiers
];
```

### Coin Reward Rate
Custom donation coin rate (1 coin per 5 UAH) can be adjusted in the `handleCustomDonation` function.

## Testing

### Manual Testing Steps
1. Log in to the application
2. Click the donate button
3. Test each donation tier
4. Test custom donation amounts
5. Verify coin balance updates
6. Check transaction history
7. Test without being logged in (should prompt to log in)

### Build Verification
```bash
npm run build
```
Should complete without errors after integration.