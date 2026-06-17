/**
 * UNO AAA Authoritative Engine
 * Supports Official Rules + House Rules (Stacking, Force Play)
 */

const engine = {
    state: {
        deck: [],
        discardPile: [],
        hands: {},
        currentPlayerIndex: 0,
        direction: 1,
        currentColor: null,
        currentValue: null,
        status: 'waiting',
        winner: null,
        playerIds: [],
        drawPending: 0,
        settings: {
            startingHandSize: 7,
            stacking: true,
            forcePlay: false,
            drawUntilPlayable: false
        }
    },

    onInit: function(settings, players) {
        this.state.settings = { ...this.state.settings, ...settings };
        this.state.playerIds = players.map(p => p.id);
        this.state.deck = this.createDeck();
        this.shuffle(this.state.deck);

        // Deal cards
        this.state.playerIds.forEach(id => {
            this.state.hands[id] = [];
            for (let i = 0; i < this.state.settings.startingHandSize; i++) {
                this.state.hands[id].push(this.state.deck.pop());
            }
        });

        // First card (non-wild)
        let firstCard = this.state.deck.pop();
        while (firstCard.color === 'Wild') {
            this.state.deck.unshift(firstCard);
            this.shuffle(this.state.deck);
            firstCard = this.state.deck.pop();
        }

        this.state.discardPile.push(firstCard);
        this.state.currentColor = firstCard.color;
        this.state.currentValue = firstCard.value;
        this.state.status = 'active';

        this.sync();
    },

    onAction: function(player, action) {
        const currentPlayerId = this.state.playerIds[this.state.currentPlayerIndex];

        if (action.type === 'PLAY_CARD') {
            // Check Stacking (Can play DrawTwo on DrawTwo even if not your turn in some house rules?
            // No, usually just allows stacking on your turn to pass the penalty).
            if (player.id !== currentPlayerId) return;
            this.handlePlay(player, action.data);
        } else if (action.type === 'DRAW_CARD') {
            if (player.id !== currentPlayerId) return;
            this.handleDraw(player);
        }
    },

    handlePlay: function(player, data) {
        const hand = this.state.hands[player.id];
        const card = hand[data.cardIndex];

        // Basic Match Logic
        let isMatch = card.color === 'Wild' ||
                      card.color === this.state.currentColor ||
                      card.value === this.state.currentValue;

        // Stacking Logic: If penalty is pending, must play same penalty card or WildDrawFour
        if (this.state.drawPending > 0) {
            if (!this.state.settings.stacking) return; // Can't play during penalty if no stacking

            const canStack = (card.value === 'DrawTwo' && this.state.currentValue === 'DrawTwo') ||
                             (card.value === 'WildDrawFour');

            if (!canStack) return;
        }

        if (!isMatch) return;

        // Apply Play
        hand.splice(data.cardIndex, 1);
        this.state.discardPile.push(card);
        this.state.currentValue = card.value;
        this.state.currentColor = data.chosenColor || card.color;

        // Check Win
        if (hand.length === 0) {
            this.state.status = 'finished';
            this.state.winner = player.id;
            this.sync();
            return;
        }

        // Effect Logic
        let skip = false;
        if (card.value === 'Skip') skip = true;
        if (card.value === 'Reverse') {
            if (this.state.playerIds.length === 2) skip = true;
            else this.state.direction *= -1;
        }

        if (card.value === 'DrawTwo') {
            this.state.drawPending += 2;
            if (!this.state.settings.stacking) {
                this.applyPenalty(this.getNextPlayerId(), this.state.drawPending);
                this.state.drawPending = 0;
                skip = true;
            }
        } else if (card.value === 'WildDrawFour') {
            this.state.drawPending += 4;
            if (!this.state.settings.stacking) {
                this.applyPenalty(this.getNextPlayerId(), this.state.drawPending);
                this.state.drawPending = 0;
                skip = true;
            }
        }

        this.advanceTurn(skip ? 2 : 1);
        this.sync();
    },

    handleDraw: function(player) {
        // If draw pending (penalty)
        if (this.state.drawPending > 0) {
            this.applyPenalty(player.id, this.state.drawPending);
            this.state.drawPending = 0;
            this.advanceTurn(1);
        } else {
            // Normal Draw
            const card = this.drawOne(player.id);

            // House Rule: Draw Until Playable
            if (this.state.settings.drawUntilPlayable) {
                let playable = this.isPlayable(card);
                while (!playable) {
                    const next = this.drawOne(player.id);
                    playable = this.isPlayable(next);
                }
            }

            // Optional: Pass turn after draw
            this.advanceTurn(1);
        }
        this.sync();
    },

    isPlayable: function(card) {
        return card.color === 'Wild' ||
               card.color === this.state.currentColor ||
               card.value === this.state.currentValue;
    },

    drawOne: function(playerId) {
        if (this.state.deck.length === 0) this.recycleDiscard();
        const card = this.state.deck.pop();
        this.state.hands[playerId].push(card);
        return card;
    },

    applyPenalty: function(playerId, count) {
        for (let i = 0; i < count; i++) {
            this.drawOne(playerId);
        }
    },

    recycleDiscard: function() {
        const top = this.state.discardPile.pop();
        this.state.deck = [...this.state.discardPile];
        this.shuffle(this.state.deck);
        this.state.discardPile = [top];
    },

    advanceTurn: function(steps) {
        const n = this.state.playerIds.length;
        this.state.currentPlayerIndex = (this.state.currentPlayerIndex + (this.state.direction * steps) + n) % n;
    },

    getNextPlayerId: function() {
        const n = this.state.playerIds.length;
        const idx = (this.state.currentPlayerIndex + this.state.direction + n) % n;
        return this.state.playerIds[idx];
    },

    sync: function() {
        const publicState = {
            topCard: this.state.discardPile[this.state.discardPile.length - 1],
            currentColor: this.state.currentColor,
            currentValue: this.state.currentValue,
            currentPlayerId: this.state.playerIds[this.state.currentPlayerIndex],
            direction: this.state.direction,
            status: this.state.status,
            winner: this.state.winner,
            drawPending: this.state.drawPending,
            playerCardCounts: {}
        };
        this.state.playerIds.forEach(id => {
            publicState.playerCardCounts[id] = this.state.hands[id].length;
        });

        Arcade.broadcastPublicState(publicState);

        this.state.playerIds.forEach(id => {
            Arcade.sendPrivateState(id, { hand: this.state.hands[id] });
        });
    },

    createDeck: function() {
        const colors = ['Red', 'Blue', 'Green', 'Yellow'];
        const values = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','DrawTwo'];
        let deck = [];
        colors.forEach(c => {
            values.forEach(v => {
                deck.push({ color: c, value: v });
                if (v !== '0') deck.push({ color: c, value: v });
            });
        });
        for (let i = 0; i < 4; i++) {
            deck.push({ color: 'Wild', value: 'Wild' });
            deck.push({ color: 'Wild', value: 'WildDrawFour' });
        }
        return deck;
    },

    shuffle: function(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
    }
};
