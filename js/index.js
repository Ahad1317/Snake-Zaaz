//constants 
let pointspanelWidth;
let pointspanelHeight;
let playpanelWidth; 
let playpanelHeight;
let playpanelHorizontalMargin;
let playscreen;
const playpanel = document.getElementById("playpanel");
const pointspanel = document.getElementById("pointspanel");
const playpanelContext = playpanel.getContext("2d");
const pointspanelContext = pointspanel.getContext("2d");
const windowHeight = window.innerHeight, windowWidth = window.innerWidth;
const ball = 50, roundRadius = 30;
const scoreFont = "Artifakt Element Black";
const gameFont = "Bahnschrift SemiBold SemiConden";
const timeOut = 200;
const startWithBlocks = 7;
const KeyPressAudio = "sound/points.mp3";
const GameOverAudio = "sound/gameover.mp3"
const takenAudio = "sound/turning.mp3";
const headColorString = "#000000"
const tailColorString = "#800000"
const borderColorString = "#FFFFFF";
const pointsColorString = "#FF0000";
const pointsNottakendColorString = "#FF0000";
const arrea = new Map();
arrea.set('L', [-ball, 0]);
arrea.set('R', [ball, 0]);
arrea.set('U', [0, -ball]);
arrea.set('D', [0, ball]);

// functions
//display
function validWindowSize(windowWidth, windowHeight, ball){
    if(windowHeight < 400 || windowWidth < 1000)return false;
    pointspanelWidth = windowWidth;
    pointspanelHeight = Math.max(50, windowHeight/11);
    playpanelWidth = windowWidth - windowWidth % ball;
    playpanelHeight = (windowHeight - pointspanelHeight) - (windowHeight - pointspanelHeight) % ball;
    playpanelHorizontalMargin = (windowWidth - playpanelWidth)/2;
    playpanel.width = playpanelWidth;
    playpanel.height = playpanelHeight;
    pointspanel.width = pointspanelWidth;
    pointspanel.height = pointspanelHeight;
    playpanel.style.marginLeft = playpanelHorizontalMargin + "px";
    playpanel.style.marginRight = playpanelHorizontalMargin + "px";
    if(playscreen !== undefined && playscreen !== null){
        playscreen.resetGame();
        playscreen.display();
    }
    return true;
}
// blur box
function boxBlur(canvasImageData, blurRadius){
    let width = canvasImageData.width, height = canvasImageData.height;
    let imageData = canvasImageData.data;
    let canvasImagePrefixSum2D = [];
    let pos = (row, col, layer) => (row*width+col)*4+layer;
    for(let r = 0; r< height; r++)
        for(let c = 0; c< width; c++)
            for(let layer = 0; layer < 4; layer++){
                let val = imageData[pos(r, c, layer)];
                if(r > 0)val += canvasImagePrefixSum2D[pos(r-1, c, layer)];
                if(c > 0)val += canvasImagePrefixSum2D[pos(r, c-1, layer)];
                if(r > 0 && c > 0)val -= canvasImagePrefixSum2D[pos(r-1, c-1, layer)];
                canvasImagePrefixSum2D.push(val);
            }
    let blurredImageData = [];
    for(let r = 0; r< height; r++)
        for(let c = 0; c< width; c++){
            let minR = Math.max(r-blurRadius, 0)-1, minC = Math.max(c-blurRadius, 0)-1;
            let maxR = Math.min(r+blurRadius, height-1), maxC = Math.min(c+blurRadius, width-1);
            let size = (maxR-minR)*(maxC-minC);
            for(let layer = 0; layer < 4; layer++){
                let sum = canvasImagePrefixSum2D[pos(maxR, maxC, layer)];
                if(minR !== -1)sum -= canvasImagePrefixSum2D[pos(minR, maxC, layer)];
                if(minC !== -1)sum -= canvasImagePrefixSum2D[pos(maxR, minC, layer)];
                if(minR !== -1 && minC !== -1)sum += canvasImagePrefixSum2D[pos(minR, minC, layer)];
                blurredImageData.push(sum/size);
            }
        }
    return new ImageData(new Uint8ClampedArray(blurredImageData), width, height);
}
function blurImage(canvasImageData){
    return boxBlur(canvasImageData, 5);
}
//play panel
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x+r, y);
    this.arcTo(x+w, y,   x+w, y+h, r);
    this.arcTo(x+w, y+h, x,   y+h, r);
    this.arcTo(x,   y+h, x,   y,   r);
    this.arcTo(x,   y,   x+w, y,   r);
    this.closePath();
    return this;
}
//sound
function playSound(file){
    let audio = document.createElement('audio');
    audio.src = file;
    audio.play()
}

function fontString(fontName, bold, size){
    return (bold === true?"Bold ":"") + size+"px "+fontName;
}

class SquareBlock{
    constructor(midX, midY, color) {
        this.midX = midX;
        this.midY = midY;
        while (this.midX < 0)this.midX += playpanelWidth;
        while (this.midX >= playpanelWidth)this.midX -= playpanelWidth;
        while (this.midY < 0)this.midY += playpanelHeight;
        while (this.midY >= playpanelHeight)this.midY -= playpanelHeight;
        this.color = color;
    }
    setColor(color){this.color = color;}
    getColor(){return this.color;}
    getMidX(){return this.midX;}
    getMidY(){return this.midY;}
    samePosition(block){return this.getMidX() === block.getMidX() && this.getMidY() === block.getMidY();}
    deepCopy(){return new SquareBlock(this.midX, this.midY, this.color);}
}
class Game{
    static namedisplay = 0;
    static pointsGain = 100;
    static moveGain = {1: 0, 2: 5};
    static namedisplay_KEYS = {1: "Freenamedisplay"};
    static STATUS = {"START": 1, "OVER": 2, "RUNNING": 4};
    static MODE = {"FREE": 1};
    constructor(playpanelContext, pointspanelContext) {
        this.playpanelContext = playpanelContext;
        this.pointspanelContext = pointspanelContext;
        this.status = null;
        this.mode = 0;
        this.snakeBody = [];
        this.points = null
    }
    resetGame(){
        this.status = Game.STATUS.START;
        this.snakeBody = [];
        this.mode = 0;
        this.points = null
        this.direction = 'L';
        this.newDirection = null;
        this.pointstakend = null;
        this.score = 0;
        let x = Math.floor(playpanelWidth/(2*ball)) * ball, y = Math.floor(playpanelHeight/(2*ball))*ball
        this.snakeBody.push(new SquareBlock(x, y, headColorString));
        for(let i = 1; i<= startWithBlocks; i++)this.snakeBody.push(new SquareBlock(x+i*ball, y, tailColorString));
        this.generatepoints();
    }
    setGameMode(mode){
        this.mode = mode;
        this.fetchnamedisplay();
    }
    incrementScore(gain){
        this.score += gain;
    }
    fetchnamedisplay(){
        let keyName = Game.namedisplay_KEYS[this.mode];
        let namedisplay = localStorage.getItem(keyName);
        if(namedisplay === null)Game.namedisplay = 0;
        else Game.namedisplay = parseInt(namedisplay);
    }
    updatenamedisplay(){
        Game.namedisplay = Math.max(Game.namedisplay, this.score);
        localStorage.setItem(Game.namedisplay_KEYS[this.mode], Game.namedisplay.toString());
    }
    generatepoints(){
        let randInt = (upto) => Math.floor(Math.random()*upto);
        let duplicate = undefined, x, y;
        do{
            x = (1+randInt(playpanelWidth/ball-2))*ball;
            y = (1+randInt(playpanelHeight/ball-2))*ball;
            let points = new SquareBlock(x, y, pointsColorString)
            duplicate = this.snakeBody.find((block) => block.samePosition(points));
        }while (duplicate !== undefined);
        this.points = new SquareBlock(x, y, pointsColorString);
    }
    updateDirection(newDirection){
        this.newDirection = newDirection;
        playSound(KeyPressAudio)
    }
    loadDirection(){
        let dir = this.newDirection;
        this.newDirection = null;
        if(dir === null)return;
        switch (dir) {
            case 'L':
                if(this.direction !== 'R')this.direction = dir;
                break;
            case 'R':
                if(this.direction !== 'L')this.direction = dir;
                break;
            case 'U':
                if(this.direction !== 'D')this.direction = dir;
                break;
            case 'D':
                if(this.direction !== 'U')this.direction = dir;
                break;
        }
    }
    performMove(){
        this.loadDirection();
        let updatedPositions = this.snakeBody.map((x) => x.deepCopy());
        let nxt = new SquareBlock(updatedPositions[0].getMidX()+arrea.get(this.direction)[0], updatedPositions[0].getMidY()+arrea.get(this.direction)[1], headColorString);

        updatedPositions[0].setColor(tailColorString)
        if(this.pointstakend !== null){
            updatedPositions.splice(0, 1, this.pointstakend);
            this.pointstakend = null;
        }else updatedPositions.pop();
        updatedPositions.splice(0, 0, nxt);

        if(this.collisionHappens(updatedPositions)) {
            let copy = this.snakeBody.find((block, index) => index > 0 && block.samePosition(nxt));
            copy.setColor(pointsNottakendColorString);
            this.displayGameRunning();
            return false;
        }

        this.incrementScore(Game.moveGain[this.mode]);
        this.snakeBody = updatedPositions;
        if(this.points.samePosition(nxt)){
            this.pointstakend = this.points;
            this.points = null;
            this.incrementScore(Game.pointsGain);
            playSound(takenAudio);
            this.generatepoints();
        }
        return true;
    }
    collisionHappens(positions){
        let copy = positions.find((block, index) => index > 0 && block.samePosition(positions[0]));
        return copy !== undefined;
    }
    displayObject(block){
        if(block === null)return;
        let topX = block.getMidX()-ball/2, topY = block.getMidY()-ball/2;
        for(let i = -1; i <= 1; i++)
            for(let j = -1; j <= 1; j++){
                let x1 = topX+i*playpanelWidth, y1 = topY+j*playpanelHeight;
                this.playpanelContext.fillStyle = block.getColor();
                this.playpanelContext.roundRect(x1, y1, ball, ball, roundRadius).fill();
                this.playpanelContext.strokeStyle = borderColorString;
                this.playpanelContext.roundRect(x1, y1, ball, ball, roundRadius).stroke();
            }
    }
    clearContexts(){
        this.playpanelContext.clearRect(0, 0, playpanelWidth, playpanelHeight);
        this.pointspanelContext.clearRect(0, 0, pointspanelWidth, pointspanelHeight);
    }
    displaypointspanel(){
        this.pointspanelContext.textBaseline = "middle";
        this.pointspanelContext.fillStyle = "#FFFFFF";

        let margin = 20;
        let width = pointspanelWidth-2*margin, height = pointspanelHeight;

        let currentScoreString = "Score:" + (""+this.score).padStart(7) + "                                                                       SNAKE   ZA❤️AZ";
        let namedisplayString = "By - AHAD" + ("").padStart(7);

        this.pointspanelContext.font = fontString(scoreFont, true, 30);
        this.pointspanelContext.textAlign = "start";
        this.pointspanelContext.fillText(currentScoreString, margin, height/2);
        this.pointspanelContext.textAlign = "end";
        this.pointspanelContext.fillText(namedisplayString, margin+width, height/2);
    }
    display(){
        switch (this.status){
            case Game.STATUS.START: this.displayGameStart();return;
            case Game.STATUS.RUNNING: this.displayGameRunning(); return;
            case Game.STATUS.OVER: this.displayGameOver(); return;
            default: console.log("Invalid Game Status")
        }
    }
    displayGameRunning(){
        this.clearContexts();
        this.displaypointspanel();

        this.snakeBody.forEach((block) => this.displayObject(block));
        this.displayObject(this.points);
    }
    displayGameStart(){
        this.clearContexts();
        this.playpanelContext.fillStyle = "#000000";
        this.playpanelContext.textAlign = "center";
        this.playpanelContext.font = fontString(gameFont, false, 170);
        this.playpanelContext.fillText("SNAKE ZA❤️AZ", playpanelWidth/2, playpanelHeight/2-20);
        this.playpanelContext.font = fontString(gameFont, false, 36);
        this.playpanelContext.fillText("HIT SPACE TO BEGIN", playpanelWidth/2, playpanelHeight/2+20);
    }
    displayGameOver(){
        let imageData = this.playpanelContext.getImageData(0, 0, playpanelWidth, playpanelHeight);
        this.clearContexts();
        this.displaypointspanel();
        let blurredImageData = blurImage(imageData);
        this.playpanelContext.putImageData(blurredImageData, 0, 0);
        this.playpanelContext.fillStyle = "#000000";
        this.playpanelContext.textAlign = "center";
        this.playpanelContext.font = fontString(gameFont, false, 72);
        this.playpanelContext.fillText("TOTAL SCORE: "+this.score, playpanelWidth/2, playpanelHeight/2-20);
        this.playpanelContext.font = fontString(gameFont, false,36);
        this.playpanelContext.fillText("THANKS FOR PLAYING ❤️", playpanelWidth/2, playpanelHeight/2+30);
    }
}
function initializeGame(){
    document.getElementById("home").style.display = "none";
    pointspanel.style.display = "block";
    playpanel.style.display = "block";
    playscreen = new Game(playpanelContext, pointspanelContext);
    playscreen.resetGame();
    playscreen.status = Game.STATUS.START;
    playscreen.display();
    document.addEventListener('keydown', (event) => {
        let keycode = event.code;
        switch (playscreen.status){
         case Game.STATUS.START:
        if(keycode === "Space"){
        playscreen.setGameMode(Game.MODE.FREE);

playscreen.status = Game.STATUS.RUNNING;
ax = setInterval(function(){
if(playscreen.performMove()){
playscreen.display();
}else{
    clearInterval(ax);
playscreen.status = Game.STATUS.OVER;
playscreen.display();
playSound(GameOverAudio);
}
}, timeOut);
}
break;
case Game.STATUS.RUNNING:
if(keycode.startsWith("Arrow"))
playscreen.updateDirection(keycode.charAt(5));
break;
case Game.STATUS.OVER:
if(keycode === "Space"){
playscreen.status = Game.STATUS.START;
playscreen.resetGame();
playscreen.display();
}
    break;
}
});


}

window.onresize = function(){window.location.reload();}

if(validWindowSize(windowWidth, windowHeight, ball))
    setTimeout(initializeGame, 3000);
