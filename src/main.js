import Phaser from 'phaser';

// ゲームの状態管理
const gameState = {
  influence: 0,
  karma: 0,
  isMenuOpen: false,
  interactionCooldown: false // 連続会話を防ぐためのクールダウンフラグ
};

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // --- 画像素材の生成（将来的には画像ファイルに置き換えます） ---
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    
    // 1. 加藤先生（青い円）
    graphics.clear();
    graphics.fillStyle(0x3498db, 1.0); // 青
    graphics.fillCircle(16, 16, 14);
    graphics.lineStyle(2, 0xffffff, 1.0);
    graphics.strokeCircle(16, 16, 14);
    graphics.generateTexture('player', 32, 32);

    // 2. 区民（赤い円）
    graphics.clear();
    graphics.fillStyle(0xe74c3c, 1.0); // 赤
    graphics.fillCircle(16, 16, 14);
    graphics.generateTexture('npc', 32, 32);

    // 3. 地面（コンクリート）
    graphics.clear();
    graphics.fillStyle(0x7f8c8d, 1.0); // グレー
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('road', 32, 32);

    // 4. 建物（濃いグレーの四角）
    graphics.clear();
    graphics.fillStyle(0x2c3e50, 1.0); // 濃い紺色
    graphics.fillRect(0, 0, 32, 32);
    graphics.lineStyle(2, 0xbdc3c7, 1.0); // 窓枠っぽい線
    graphics.strokeRect(2, 2, 28, 28);
    graphics.generateTexture('building', 32, 32);
    
    // 5. 芝生（緑）
    graphics.clear();
    graphics.fillStyle(0x27ae60, 1.0);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('grass', 32, 32);
  }

  create() {
    // --- マップ生成（品川区風の道路とビル） ---
    this.physics.world.setBounds(0, 0, 2000, 2000);
    
    // グループ作成
    this.buildings = this.physics.add.staticGroup();

    // 簡易的な街生成アルゴリズム
    // 60x60マスのマップを作る
    for (let x = 0; x < 60; x++) {
      for (let y = 0; y < 60; y++) {
        const posX = x * 32;
        const posY = y * 32;

        // 道路を作る（十字路状に空ける）
        // 5マスごとに道路を通す
        if (x % 5 === 0 || y % 5 === 0) {
          this.add.image(posX, posY, 'road').setOrigin(0);
        } else {
          // 道路じゃない場所
          // ランダムで「ビル」か「芝生」にする
          if (Phaser.Math.Between(0, 10) > 3) {
            // ビル（当たり判定あり）
            const b = this.buildings.create(posX + 16, posY + 16, 'building');
            b.refreshBody(); // 静的ボディの更新
          } else {
            // 芝生（歩ける）
            this.add.image(posX, posY, 'grass').setOrigin(0);
          }
        }
      }
    }

    // --- プレイヤー作成 ---
    // 道路の上（座標0,0付近）に出現させる
    this.player = this.physics.add.sprite(160, 160, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10); // 建物より手前に表示

    // --- カメラ設定 ---
    this.cameras.main.setBounds(0, 0, 2000, 2000);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.2); // 少しズームして見やすく

    // --- NPC作成 ---
    this.npcs = this.physics.add.group();
    
    // 15人の区民を道路上に配置
    for(let i=0; i<15; i++) {
      let placed = false;
      while(!placed) {
        const tx = Phaser.Math.Between(0, 59);
        const ty = Phaser.Math.Between(0, 59);
        
        // 道路の上（座標が5の倍数）なら配置OK
        if (tx % 5 === 0 || ty % 5 === 0) {
          const npc = this.npcs.create(tx * 32 + 16, ty * 32 + 16, 'npc');
          npc.setImmovable(true);
          npc.name = `区民 ${i+1}`;
          placed = true;
        }
      }
    }

    // --- 当たり判定 ---
    // プレイヤー vs ビル（ぶつかる）
    this.physics.add.collider(this.player, this.buildings);
    
    // プレイヤー vs NPC（会話イベント）
    this.physics.add.overlap(this.player, this.npcs, this.handleNpcCollision, null, this);

    // --- 操作設定 ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.mobileInput = { up: false, down: false, left: false, right: false };
    this.setupMobileControls();

    // 初期メッセージ
    this.showMessage("加藤: 「ここが品川...まずは情報収集だ。」");
  }

  update() {
    if (gameState.isMenuOpen) {
      this.player.setVelocity(0);
      return;
    }

    const speed = 200;
    this.player.setVelocity(0);

    // 移動処理
    let moveX = 0;
    let moveY = 0;

    if (this.cursors.left.isDown || this.mobileInput.left) moveX = -1;
    else if (this.cursors.right.isDown || this.mobileInput.right) moveX = 1;

    if (this.cursors.up.isDown || this.mobileInput.up) moveY = -1;
    else if (this.cursors.down.isDown || this.mobileInput.down) moveY = 1;

    // 斜め移動の速度補正
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.707;
      moveY *= 0.707;
    }

    this.player.setVelocity(moveX * speed, moveY * speed);
  }

  handleNpcCollision(player, npc) {
    // メニューが開いている、またはクールダウン中なら何もしない
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
      // タッチ対応
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.mobileInput[direction] = true; });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); this.mobileInput[direction] = false; });
      // PCクリック対応
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
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: GameScene
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

// --- UIアクション関数 ---

// クールダウンを開始する関数
function startCooldown() {
  gameState.interactionCooldown = true;
  // 1.5秒後に会話可能に戻す
  setTimeout(() => {
    gameState.interactionCooldown = false;
  }, 1500);
}

window.gameAction = (action) => {
  const npc = gameState.currentTargetNpc;
  let msg = "";

  if (action === 'talk') {
    msg = `${npc.name}: 「品川駅の工事、いつ終わるんでしょうね...」`;
    gameState.influence += 2;
  } else if (action === 'bribe') {
    msg = `${npc.name}: 「へへっ、加藤先生、いい人ですねぇ。」`;
    gameState.influence += 5;
    gameState.karma -= 2;
  } else if (action === 'punch') {
    msg = `加藤先生は${npc.name}に鉄拳制裁を加えた！\n${npc.name}: 「ぎゃあ！」`;
    gameState.influence += 10;
    gameState.karma -= 10;
    npc.setTint(0x000000); 
  }

  updateStatusUI();
  document.getElementById('action-menu').classList.add('hidden');
  
  // メッセージ表示
  const scene = game.scene.scenes[0];
  scene.showMessage(msg);
};

window.closeMenu = () => {
  document.getElementById('action-menu').classList.add('hidden');
  gameState.isMenuOpen = false;
  startCooldown(); // 閉じた直後は会話しない
};

window.closeMessage = () => {
  document.getElementById('message-box').classList.add('hidden');
  gameState.isMenuOpen = false;
  startCooldown(); // 閉じた直後は会話しない
};

function updateStatusUI() {
  document.getElementById('influence').innerText = `支配率: ${gameState.influence}%`;
  let karmaText = "普通";
  if (gameState.karma > 10) karmaText = "聖人";
  if (gameState.karma < -10) karmaText = "狂犬";
  document.getElementById('karma').innerText = `評判: ${karmaText}`;
}