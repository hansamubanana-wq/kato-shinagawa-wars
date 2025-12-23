import Phaser from 'phaser';

// ゲームの状態管理
const gameState = {
  influence: 0,
  karma: 0,
  isMenuOpen: false,
  interactionCooldown: false
};

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    
    // 1. 加藤先生（青い円）
    graphics.clear();
    graphics.fillStyle(0x3498db, 1.0);
    graphics.fillCircle(16, 16, 14);
    graphics.lineStyle(2, 0xffffff, 1.0);
    graphics.strokeCircle(16, 16, 14);
    graphics.generateTexture('player', 32, 32);

    // 2. 区民（赤い円）
    graphics.clear();
    graphics.fillStyle(0xe74c3c, 1.0);
    graphics.fillCircle(16, 16, 14);
    graphics.generateTexture('npc', 32, 32);

    // 3. 地面
    graphics.clear();
    graphics.fillStyle(0x7f8c8d, 1.0);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('road', 32, 32);

    // 4. 建物
    graphics.clear();
    graphics.fillStyle(0x2c3e50, 1.0);
    graphics.fillRect(0, 0, 32, 32);
    graphics.lineStyle(2, 0xbdc3c7, 1.0);
    graphics.strokeRect(2, 2, 28, 28);
    graphics.generateTexture('building', 32, 32);
    
    // 5. 芝生
    graphics.clear();
    graphics.fillStyle(0x27ae60, 1.0);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('grass', 32, 32);
  }

  create() {
    // --- マップ生成 ---
    this.physics.world.setBounds(0, 0, 2400, 2400);
    this.buildings = this.physics.add.staticGroup();

    // マップを少し広げる (75x75)
    for (let x = 0; x < 75; x++) {
      for (let y = 0; y < 75; y++) {
        const posX = x * 32;
        const posY = y * 32;

        // 道路を少し広くするロジック
        // 4マスおきに道を作る
        if (x % 4 === 0 || y % 4 === 0) {
          this.add.image(posX, posY, 'road').setOrigin(0);
        } else {
          if (Phaser.Math.Between(0, 10) > 2) {
            const b = this.buildings.create(posX + 16, posY + 16, 'building');
            b.refreshBody();
          } else {
            this.add.image(posX, posY, 'grass').setOrigin(0);
          }
        }
      }
    }

    // --- プレイヤー作成（ここが修正ポイント！） ---
    this.player = this.physics.add.sprite(160, 160, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    
    // ★重要：当たり判定のサイズを小さくする（見た目は32pxだが、判定は20px）
    // これで狭い隙間も通りやすくなる
    this.player.body.setSize(20, 20);
    this.player.body.setOffset(6, 6); // 中心に合わせる

    // --- カメラ設定 ---
    this.cameras.main.setBounds(0, 0, 2400, 2400);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.3);

    // --- NPC作成 ---
    this.npcs = this.physics.add.group();
    for(let i=0; i<20; i++) {
      let placed = false;
      while(!placed) {
        const tx = Phaser.Math.Between(0, 74);
        const ty = Phaser.Math.Between(0, 74);
        if (tx % 4 === 0 || ty % 4 === 0) { // 道の上に配置
          const npc = this.npcs.create(tx * 32 + 16, ty * 32 + 16, 'npc');
          npc.setImmovable(true);
          npc.name = `区民 ${i+1}`;
          placed = true;
        }
      }
    }

    // --- 当たり判定 ---
    this.physics.add.collider(this.player, this.buildings);
    this.physics.add.overlap(this.player, this.npcs, this.handleNpcCollision, null, this);

    // --- 操作設定 ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.mobileInput = { up: false, down: false, left: false, right: false };
    this.setupMobileControls();

    this.showMessage("加藤: 「よし、動きやすくなったな。探索再開だ。」");
  }

  update() {
    if (gameState.isMenuOpen) {
      this.player.setVelocity(0);
      return;
    }

    const speed = 200;
    this.player.setVelocity(0);

    let moveX = 0;
    let moveY = 0;

    if (this.cursors.left.isDown || this.mobileInput.left) moveX = -1;
    else if (this.cursors.right.isDown || this.mobileInput.right) moveX = 1;

    if (this.cursors.up.isDown || this.mobileInput.up) moveY = -1;
    else if (this.cursors.down.isDown || this.mobileInput.down) moveY = 1;

    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.707;
      moveY *= 0.707;
    }

    this.player.setVelocity(moveX * speed, moveY * speed);
  }

  handleNpcCollision(player, npc) {
    if (gameState.isMenuOpen || gameState.interactionCooldown) return;
    this.openInteractionMenu(npc);
  }

  openInteractionMenu(npc) {
    gameState.isMenuOpen = true;
    gameState.currentTargetNpc = npc;
    const menu = document.getElementById('action-menu');
    document.getElementById('target-name').innerText = npc.name;
    menu.classList.remove('hidden');
  }

  showMessage(text) {
    const box = document.getElementById('message-box');
    const p = document.getElementById('message-text');
    p.innerText = text;
    box.classList.remove('hidden');
  }

  setupMobileControls() {
    const bindBtn = (id, direction) => {
      const btn = document.getElementById(id);
      if(!btn) return;
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.mobileInput[direction] = true; });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); this.mobileInput[direction] = false; });
      btn.addEventListener('mousedown', () => { this.mobileInput[direction] = true; });
      btn.addEventListener('mouseup', () => { this.mobileInput[direction] = false; });
      btn.addEventListener('mouseleave', () => { this.mobileInput[direction] = false; });
    };

    bindBtn('dpad-up', 'up');
    bindBtn('dpad-down', 'down');
    bindBtn('dpad-left', 'left');
    bindBtn('dpad-right', 'right');
  }
}

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false } // debug: true にすると当たり判定が見えます
  },
  scene: GameScene
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

// --- UIアクション ---
function startCooldown() {
  gameState.interactionCooldown = true;
  setTimeout(() => { gameState.interactionCooldown = false; }, 1000);
}

window.gameAction = (action) => {
  const npc = gameState.currentTargetNpc;
  let msg = "";

  if (action === 'talk') {
    const talks = [
      "「最近、大井町の開発がすごいらしいですよ。」",
      "「五反田あたりは治安が...いや、なんでもないです。」",
      "「先生の授業、実は結構好きでした。」"
    ];
    msg = `${npc.name}: ${talks[Math.floor(Math.random() * talks.length)]}`;
    gameState.influence += 2;
  } else if (action === 'bribe') {
    msg = `${npc.name}: 「へへっ、まいどあり。」`;
    gameState.influence += 5;
    gameState.karma -= 2;
  } else if (action === 'punch') {
    msg = `加藤先生は${npc.name}を殴った！\n${npc.name}: 「あ痛っ！！」`;
    gameState.influence += 10;
    gameState.karma -= 10;
    npc.setTint(0x000000); 
  }

  updateStatusUI();
  document.getElementById('action-menu').classList.add('hidden');
  const scene = game.scene.scenes[0];
  scene.showMessage(msg);
};

window.closeMenu = () => {
  document.getElementById('action-menu').classList.add('hidden');
  gameState.isMenuOpen = false;
  startCooldown();
};

window.closeMessage = () => {
  document.getElementById('message-box').classList.add('hidden');
  gameState.isMenuOpen = false;
  startCooldown();
};

function updateStatusUI() {
  document.getElementById('influence').innerText = `支配率: ${gameState.influence}%`;
  let karmaText = "普通";
  if (gameState.karma > 15) karmaText = "聖人";
  if (gameState.karma < -15) karmaText = "狂犬";
  document.getElementById('karma').innerText = `評判: ${karmaText}`;
}