const TASKS_URLS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/vision_bundle.mjs"
];
const WASM_URLS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm"
];
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const ROUND_SECONDS = 60;
const GAZE_SACCADE_SPEED = 1.05;
const MOTION_ENTER = 0.028;
const MOTION_EXIT = 0.015;
const MOBILE_DEVICE =
  !!window.matchMedia?.("(pointer: coarse)")?.matches ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||"");

const TOPBAR = () => {
  const bar=document.querySelector(".topbar");
  return bar?.getBoundingClientRect?.().height || (innerWidth<=650?68:88);
};

const RIGHT_EYE_CORNERS=[33,133], LEFT_EYE_CORNERS=[362,263];
const RIGHT_EYE_LIDS=[159,145], LEFT_EYE_LIDS=[386,374];
const RIGHT_IRIS=[468,469,470,471,472], LEFT_IRIS=[473,474,475,476,477];
const EYE_IDS=[...RIGHT_EYE_CORNERS,...LEFT_EYE_CORNERS,...RIGHT_EYE_LIDS,...LEFT_EYE_LIDS,...RIGHT_IRIS,...LEFT_IRIS];

const $=id=>document.getElementById(id);
const video=$("webcam"), canvas=$("gameCanvas"), ctx=canvas.getContext("2d");
const probeCanvas=$("probeCanvas"), probeCtx=probeCanvas.getContext("2d",{willReadFrequently:true});
const preview=$("previewCanvas"), previewCtx=preview.getContext("2d");
const screens={INTRO:$("introScreen"),LOADING:$("loadingScreen"),CALIBRATE:$("calibrationScreen"),READY:$("readyScreen"),GAMEOVER:$("gameOverScreen"),ERROR:$("errorScreen")};

let state="INTRO";
let W=innerWidth,H=innerHeight,DPR=Math.min(2,window.devicePixelRatio||1);
function resize(){
  W=innerWidth;H=innerHeight;DPR=Math.min(2,devicePixelRatio||1);
  canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);
  canvas.style.width=W+"px";canvas.style.height=H+"px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
  if(state==="CALIBRATE") cal.placePoint();
  if(state==="READY") placeReadyTarget();
}
addEventListener("resize",resize);resize();

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rand=(a,b)=>a+Math.random()*(b-a);
const choice=a=>a[(Math.random()*a.length)|0];

function withTimeout(promise,ms,label="Operation"){
  let timer;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(`${label} timed out. Check your connection and try again.`)),ms);
  });
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}

function setState(next){
  state=next;
  document.body.dataset.state=next.toLowerCase();

  Object.entries(screens).forEach(([k,n])=>{
    const active=(k===next)||((next==="VALIDATE")&&k==="CALIBRATE");
    n.classList.toggle("active",active);
  });

  const stateLabel={
    INTRO:"READY",
    LOADING:"SETTING UP",
    CALIBRATE:"SETUP",
    VALIDATE:"TUNING",
    READY:"READY",
    PLAY:"FLYING",
    GAMEOVER:"FINISHED",
    ERROR:"CHECK CAMERA"
  }[next]||next;
  if($("statePill")) $("statePill").textContent=stateLabel;

  if(next==="CALIBRATE"){
    const h=document.querySelector(".cal-copy h2"),p=document.querySelector(".cal-copy p");
    if(h)h.textContent="Follow each point with your eyes";
    if(p)p.textContent=MOBILE_DEVICE?"Keep the phone and your head steady while we map both eyes.":"Keep your head comfortably still while we map your gaze.";
    if($("calStage")) $("calStage").textContent="MAP";
    cal.placePoint();
  }

  if(next==="VALIDATE"){
    const h=document.querySelector(".cal-copy h2"),p=document.querySelector(".cal-copy p");
    if(h)h.textContent="Accuracy check";
    if(p)p.textContent=MOBILE_DEVICE?"Nine quick points tighten the map for a small screen.":"Five quick points tighten the gaze map.";
    if($("calStage")) $("calStage").textContent="VERIFY";
    validation.placePoint();
  }

  if(next==="READY"){
    readyTuneSamples=[];readyTuneElapsed=0;readyAutoTuned=!MOBILE_DEVICE||mouseMode;
    startDwell=0;resetGazeFilters();placeReadyTarget();
  }
  if(next==="CALIBRATE"||next==="VALIDATE")resetGazeFilters();

  const gazeCursor=$("gazeCursor");
  if(gazeCursor && next!=="READY" && next!=="PLAY"){
    gazeCursor.classList.remove("visible");
  }
}
function toast(msg,ms=900){
  const t=$("toast");t.textContent=msg;t.classList.add("visible");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("visible"),ms);
}
function showError(title,message,steps=""){
  $("errorTitle").textContent=title;$("errorMessage").textContent=message;$("errorSteps").innerHTML=steps;setState("ERROR");
}

function solveLinear(A,b){
  const n=b.length;
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;
    if(Math.abs(A[p][c])<1e-10)return null;
    [A[c],A[p]]=[A[p],A[c]];[b[c],b[p]]=[b[p],b[c]];
    const d=A[c][c];for(let j=c;j<n;j++)A[c][j]/=d;b[c]/=d;
    for(let r=0;r<n;r++){if(r===c)continue;const f=A[r][c];for(let j=c;j<n;j++)A[r][j]-=f*A[c][j];b[r]-=f*b[c];}
  }
  return b;
}

class OneEuro1D{
  constructor(minCutoff=1.45,beta=.48,dCutoff=1){
    this.minCutoff=minCutoff;this.beta=beta;this.dCutoff=dCutoff;
    this.reset();
  }
  reset(){
    this.lastT=null;this.lastX=null;this.xHat=null;this.dxHat=0;
  }
  alpha(cutoff,dt){
    const tau=1/(2*Math.PI*Math.max(.001,cutoff));
    return 1/(1+tau/Math.max(.001,dt));
  }
  filter(x,t){
    if(this.lastT==null){
      this.lastT=t;this.lastX=x;this.xHat=x;this.dxHat=0;
      return x;
    }
    const dt=clamp(t-this.lastT,1/120,.12);
    const dx=(x-this.lastX)/dt;
    const ad=this.alpha(this.dCutoff,dt);
    this.dxHat=ad*dx+(1-ad)*this.dxHat;
    const cutoff=this.minCutoff+this.beta*Math.abs(this.dxHat);
    const a=this.alpha(cutoff,dt);
    this.xHat=a*x+(1-a)*this.xHat;
    this.lastT=t;this.lastX=x;
    return this.xHat;
  }
}
class CalibrationModel{
  constructor(){
    this.cx=null;this.cy=null;this.rmse=null;
    this.samples=[];
    this.bias={x:0,y:0};
    this.validationError=null;
    this.poseRef=null;
  }
  get ready(){return !!(this.cx&&this.cy)}

  features(raw){
    const x=raw.x,y=raw.y;
    if(MOBILE_DEVICE && Number.isFinite(raw.rx) && Number.isFinite(raw.lx)){
      const dx=raw.rx-raw.lx,dy=raw.ry-raw.ly;
      return[1,x,y,x*y,x*x,y*y,dx,dy];
    }
    return[1,x,y,x*y,x*x,y*y];
  }

  baseMap(raw){
    const f=this.features(raw),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
    return{x:dot(f,this.cx),y:dot(f,this.cy)};
  }

  localMap(raw){
    if(this.samples.length<5)return null;
    const nearest=this.samples
      .map(s=>({
        ...s,
        d:(raw.x-s.raw.x)**2+(raw.y-s.raw.y)**2
      }))
      .sort((a,b)=>a.d-b.d)
      .slice(0,MOBILE_DEVICE?8:6);

    const n=3,ATA=Array.from({length:n},()=>Array(n).fill(0));
    const ATx=Array(n).fill(0),ATy=Array(n).fill(0);
    for(const s of nearest){
      const f=[1,s.raw.x,s.raw.y];
      const w=1/(s.d+.0012);
      for(let i=0;i<n;i++){
        ATx[i]+=w*f[i]*s.sx;ATy[i]+=w*f[i]*s.sy;
        for(let j=0;j<n;j++)ATA[i][j]+=w*f[i]*f[j];
      }
    }
    for(let i=0;i<n;i++)ATA[i][i]+=1e-5;
    const cx=solveLinear(ATA.map(r=>[...r]),[...ATx]);
    const cy=solveLinear(ATA.map(r=>[...r]),[...ATy]);
    if(!cx||!cy)return null;
    const f=[1,raw.x,raw.y],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
    return{x:dot(f,cx),y:dot(f,cy)};
  }

  fit(samples,preserveBias=false){
    if(samples.length<(MOBILE_DEVICE?14:10))return false;
    const featureCount=this.features(samples[0].raw).length;
    const ATA=Array.from({length:featureCount},()=>Array(featureCount).fill(0));
    const ATx=Array(featureCount).fill(0),ATy=Array(featureCount).fill(0);

    for(const s of samples){
      const f=this.features(s.raw);
      const q=clamp(s.raw.quality??1,.25,1);
      const w=.55+.45*q;
      for(let i=0;i<featureCount;i++){
        ATx[i]+=w*f[i]*s.sx;ATy[i]+=w*f[i]*s.sy;
        for(let j=0;j<featureCount;j++)ATA[i][j]+=w*f[i]*f[j];
      }
    }

    // Slightly stronger ridge on the binocular correction terms keeps the
    // model stable when head pose barely changes during calibration.
    for(let i=0;i<featureCount;i++){
      ATA[i][i]+=i>=6?2e-3:3e-5;
    }

    this.cx=solveLinear(ATA.map(r=>[...r]),[...ATx]);
    this.cy=solveLinear(ATA.map(r=>[...r]),[...ATy]);
    if(!this.ready)return false;

    this.samples=samples.map(s=>({raw:{...s.raw},sx:s.sx,sy:s.sy}));

    const poseSamples=this.samples.map(s=>s.raw).filter(r=>
      Number.isFinite(r.poseX)&&Number.isFinite(r.poseY)&&Number.isFinite(r.faceScale)
    );
    if(poseSamples.length){
      const med=arr=>{const a=[...arr].sort((x,y)=>x-y);return a[(a.length/2)|0]};
      this.poseRef={
        x:med(poseSamples.map(r=>r.poseX)),
        y:med(poseSamples.map(r=>r.poseY)),
        scale:med(poseSamples.map(r=>r.faceScale))
      };
    }

    if(!preserveBias)this.bias={x:0,y:0};

    let e=0;
    for(const s of this.samples){
      const p=this.map(s.raw,false);
      e+=(p.x-s.sx)**2+(p.y-s.sy)**2;
    }
    this.rmse=Math.sqrt(e/this.samples.length);
    return true;
  }

  map(raw,useBias=true){
    const base=this.baseMap(raw);
    const local=this.localMap(raw);
    let x=base.x,y=base.y;

    if(local){
      // Dense mobile calibration makes local affine interpolation especially
      // useful on small screens. Limit its deviation to avoid edge explosions.
      const blend=MOBILE_DEVICE?.68:.46;
      const lx=clamp(local.x,base.x-.13,base.x+.13);
      const ly=clamp(local.y,base.y-.13,base.y+.13);
      x=base.x*(1-blend)+lx*blend;
      y=base.y*(1-blend)+ly*blend;
    }

    if(useBias){x+=this.bias.x;y+=this.bias.y}
    return{x:clamp(x,0,1),y:clamp(y,0,1)};
  }

  refine(records){
    const extra=records
      .filter(r=>r.raw)
      .map(r=>({raw:{...r.raw},sx:r.sx,sy:r.sy}));
    if(!extra.length)return false;
    const oldBias={...this.bias};
    const ok=this.fit([...this.samples,...extra],true);
    if(ok)this.bias=oldBias;
    return ok;
  }

  applyValidation(records){
    if(!records.length)return null;
    let bx=0,by=0,n=0;
    for(const r of records){
      if(!r.raw)continue;
      const p=this.map(r.raw,false);
      bx+=r.sx-p.x;by+=r.sy-p.y;n++;
    }
    if(!n)return null;
    bx/=n;by/=n;
    this.bias.x=clamp(bx,-.12,.12);
    this.bias.y=clamp(by,-.12,.12);

    let e=0;
    for(const r of records){
      if(!r.raw)continue;
      const p=this.map(r.raw,true);
      e+=(p.x-r.sx)**2+(p.y-r.sy)**2;
    }
    this.validationError=Math.sqrt(e/n);
    return this.validationError;
  }

  adaptFromLock(gazeNorm,targetNorm){
    const limit=MOBILE_DEVICE?.022:.03;
    const rate=MOBILE_DEVICE?.045:.06;
    const ex=clamp(targetNorm.x-gazeNorm.x,-limit,limit);
    const ey=clamp(targetNorm.y-gazeNorm.y,-limit,limit);
    this.bias.x=clamp(this.bias.x*(1-rate)+ex*rate,-.12,.12);
    this.bias.y=clamp(this.bias.y*(1-rate)+ey*rate,-.12,.12);
  }

  poseStable(raw){
    if(!MOBILE_DEVICE||!this.poseRef||!raw)return true;
    if(!Number.isFinite(raw.poseX)||!Number.isFinite(raw.poseY)||!Number.isFinite(raw.faceScale))return true;
    const dx=Math.abs(raw.poseX-this.poseRef.x);
    const dy=Math.abs(raw.poseY-this.poseRef.y);
    const ratio=raw.faceScale/Math.max(1e-6,this.poseRef.scale);
    return dx<.060&&dy<.072&&ratio>.76&&ratio<1.30;
  }

  recenter(raw,target={x:.5,y:.5}){
    const p=this.map(raw,true);
    this.bias.x=clamp(this.bias.x+(target.x-p.x),-.15,.15);
    this.bias.y=clamp(this.bias.y+(target.y-p.y),-.15,.15);
  }
}

async function importTasksVision(){
  let lastError=null;
  for(const url of TASKS_URLS){
    try{
      return await withTimeout(import(url),18000,"Gaze engine download");
    }catch(e){
      lastError=e;
      console.warn("Gaze engine import failed:",url,e);
    }
  }
  throw lastError||new Error("Could not load the gaze engine.");
}

class Tracker{
  constructor(){
    this.FaceLandmarker=null;this.FilesetResolver=null;this.landmarker=null;this.stream=null;
    this.raw=null;this.faceFound=false;this.lastFace=0;this.lastRawTime=0;this.velocity=0;
    this.eyeBox=null;this.eyePoints=[];this.prevProbe=null;this.motionScore=0;this.moving=false;
    this.landingUntil=0;this.lastPrecision=0;this.precisionPasses=0;this.framesSeen=0;
    this.mode="IDLE";this.precisionHz=0;this.lastVideoTime=-1;this.activeDeviceId="";this.ready=false;this.avgInferenceMs=0;
  }
  async loadModel(){
    $("loadingTitle").textContent="Loading gaze engine…";
    $("loadingDetail").textContent="Preparing on-device eye tracking.";
    const mod=await importTasksVision();
    this.FaceLandmarker=mod.FaceLandmarker;this.FilesetResolver=mod.FilesetResolver;

    let vision=null,last=null;
    for(const wasm of WASM_URLS){
      try{
        vision=await withTimeout(this.FilesetResolver.forVisionTasks(wasm),20000,"Vision runtime");
        break;
      }catch(e){
        last=e;
        console.warn("Vision runtime failed:",wasm,e);
      }
    }
    if(!vision)throw last||new Error("Could not load the vision runtime.");

    const options={
      baseOptions:{modelAssetPath:MODEL_URL,delegate:"GPU"},
      runningMode:"VIDEO",
      numFaces:1,
      minFaceDetectionConfidence:.5,
      minFacePresenceConfidence:.5,
      minTrackingConfidence:.5
    };

    try{
      this.landmarker=await withTimeout(
        this.FaceLandmarker.createFromOptions(vision,options),
        35000,
        "Eye-tracking model"
      );
    }catch(gpuError){
      console.warn("GPU mode failed; retrying compatibility mode.",gpuError);
      $("loadingDetail").textContent="Switching to compatibility mode…";
      this.landmarker=await withTimeout(
        this.FaceLandmarker.createFromOptions(
          vision,
          {...options,baseOptions:{modelAssetPath:MODEL_URL,delegate:"CPU"}}
        ),
        35000,
        "Compatibility eye-tracking model"
      );
    }
  }
  cameraConstraints(deviceId=""){
    const mobile=MOBILE_DEVICE;
    const videoConstraints={
      width:{ideal:mobile?1280:960},
      height:{ideal:mobile?720:540},
      frameRate:{ideal:30,max:mobile?30:60}
    };
    if(deviceId)videoConstraints.deviceId={exact:deviceId};
    else videoConstraints.facingMode={ideal:"user"};
    return{video:videoConstraints,audio:false};
  }

  async attachStream(stream,deviceId=""){
    const previous=this.stream;
    video.playsInline=true;
    video.autoplay=true;
    video.muted=true;
    video.setAttribute("playsinline","");
    video.srcObject=stream;

    try{
      await withTimeout(video.play(),5000,"Camera preview");
    }catch(e){
      console.warn("Initial video.play() failed; retrying once.",e);
      await new Promise(r=>setTimeout(r,100));
      await withTimeout(video.play(),5000,"Camera preview");
    }

    // Promote the replacement before releasing the old camera so an old
    // track-ending event can never be mistaken for a live-camera failure.
    this.stream=stream;
    if(previous && previous!==stream)previous.getTracks().forEach(t=>t.stop());

    const track=stream.getVideoTracks()[0];
    this.activeDeviceId=track?.getSettings?.().deviceId||deviceId||"";
    this.ready=true;
    this.faceFound=false;
    this.lastFace=performance.now();

    // Detect unplugged cameras / permission revocations instead of freezing on stale gaze.
    if(track){
      track.addEventListener?.("ended",()=>{
        if(this.stream!==stream)return;
        this.ready=false;this.faceFound=false;this.raw=null;
        $("cameraCard").classList.remove("visible","mobile-open");
        if(state!=="INTRO"&&state!=="ERROR"){
          showError(
            "Camera disconnected",
            "Eye Flight lost access to the camera.",
            "Reconnect or re-enable the camera, then choose <b>Try again</b>. Demo mode is always available."
          );
        }
      },{once:true});
    }

    $("cameraCard").classList.add("visible");
    this.updateCameraStatus();
  }
  async requestInitialCamera(){
    $("loadingTitle").textContent=MOBILE_DEVICE?"Connecting front camera…":"Connecting camera…";
    $("loadingDetail").textContent="Your browser will ask for camera permission.";
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("This browser does not expose the webcam API.");

    // One camera request only: on phones, prefer the user-facing/selfie camera.
    // Avoiding an immediate stop/re-open makes mobile Safari/Chrome startup more reliable.
    const stream=await navigator.mediaDevices.getUserMedia(this.cameraConstraints(""));
    await this.attachStream(stream,"");

    try{
      const devices=await navigator.mediaDevices.enumerateDevices();
      const cams=devices.filter(d=>d.kind==="videoinput");
      this.populateCameras(cams,this.activeDeviceId);
    }catch(e){
      console.warn("Camera enumeration unavailable; continuing with active camera.",e);
      this.populateCameras([],this.activeDeviceId);
    }
    if(!this.deviceChangeBound){
      navigator.mediaDevices.addEventListener?.("devicechange",()=>this.refreshCameras());
      this.deviceChangeBound=true;
    }
  }

  async openCamera(deviceId){
    const stream=await navigator.mediaDevices.getUserMedia(this.cameraConstraints(deviceId));
    await this.attachStream(stream,deviceId);
  }
  async refreshCameras(){
    try{const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="videoinput");this.populateCameras(devices,this.activeDeviceId)}catch(_){}
  }
  populateCameras(cams,selected){
    const sel=$("cameraSelect");sel.innerHTML="";
    cams.forEach((d,i)=>{const o=document.createElement("option");o.value=d.deviceId;o.textContent=d.label||`Camera ${i+1}`;if(d.deviceId===selected)o.selected=true;sel.appendChild(o)});
    if(!cams.length){const o=document.createElement("option");o.textContent="Camera";sel.appendChild(o)}
  }
  async switchCamera(deviceId){
    if(!deviceId||deviceId===this.activeDeviceId)return;
    setState("LOADING");$("loadingTitle").textContent="Switching camera…";$("loadingDetail").textContent="Reconnecting to your selected camera.";
    await this.openCamera(deviceId);await this.refreshCameras();
    calibrationModel.cx=calibrationModel.cy=null;
    calibrationModel.bias={x:0,y:0};
    this.raw=null;this.faceFound=false;this.eyeBox=null;this.eyePoints=[];this.prevProbe=null;
    cal.reset();validation.reset();smoothed=null;prevSmoothed=null;gazeTrail=[];
    setState("CALIBRATE");
  }
  updateCameraStatus(){
    const track=this.stream?.getVideoTracks?.()[0],s=track?.getSettings?.()||{};
    $("cameraStatus").textContent=track?`${track.label||"Camera"} • ${s.width||"?"}×${s.height||"?"}`:"Camera unavailable";
  }
  mean(lms,ids){let x=0,y=0;for(const id of ids){x+=lms[id].x;y+=lms[id].y}return{x:x/ids.length,y:y/ids.length}}
  eyeRatio(lms,corners,lids,iris){
    const a=lms[corners[0]],b=lms[corners[1]];
    const top=lms[lids[0]],bottom=lms[lids[1]];
    const center=this.mean(lms,iris);

    let hx=b.x-a.x,hy=b.y-a.y;
    const width=Math.max(1e-6,Math.hypot(hx,hy));
    hx/=width;hy/=width;

    // Orient the local horizontal axis left->right in image coordinates.
    if(hx<0){hx*=-1;hy*=-1}

    // Perpendicular axis, oriented downward in image coordinates.
    let vx=-hy,vy=hx;
    if(vy<0){vx*=-1;vy*=-1}

    const dot=(p,x,y)=>p.x*x+p.y*y;
    const ah=dot(a,hx,hy),bh=dot(b,hx,hy),ih=dot(center,hx,hy);
    const tv=dot(top,vx,vy),bv=dot(bottom,vx,vy),iv=dot(center,vx,vy);

    const x=(ih-Math.min(ah,bh))/Math.max(1e-6,Math.abs(bh-ah));
    const y=(iv-Math.min(tv,bv))/Math.max(1e-6,Math.abs(bv-tv));
    const openness=Math.abs(bv-tv)/width;

    const geometryQuality=
      clamp((width-.022)/.045,0,1)*
      clamp(openness/.18,.35,1);

    return{x,y,width,openness,quality:geometryQuality};
  }

  extract(lms){
    if(!lms||lms.length<478)return null;

    const r=this.eyeRatio(lms,RIGHT_EYE_CORNERS,RIGHT_EYE_LIDS,RIGHT_IRIS);
    const l=this.eyeRatio(lms,LEFT_EYE_CORNERS,LEFT_EYE_LIDS,LEFT_IRIS);

    if(
      !Number.isFinite(r.x)||!Number.isFinite(r.y)||
      !Number.isFinite(l.x)||!Number.isFinite(l.y)
    )return null;

    const wr=clamp(r.quality,.18,1),wl=clamp(l.quality,.18,1),ws=wr+wl;
    const x=(r.x*wr+l.x*wl)/ws;
    const y=(r.y*wr+l.y*wl)/ws;
    const agreement=Math.hypot(r.x-l.x,r.y-l.y);
    const agreementQuality=clamp(1-agreement/.34,0,1);
    const quality=clamp((wr+wl)*.5*.55+agreementQuality*.45,0,1);

    const eyeA=lms[33],eyeB=lms[263],bridge=lms[168]||lms[6]||{x:(eyeA.x+eyeB.x)/2,y:(eyeA.y+eyeB.y)/2};
    const faceScale=Math.max(1e-6,Math.hypot(eyeB.x-eyeA.x,eyeB.y-eyeA.y));
    const raw={
      x,y,
      rx:r.x,ry:r.y,
      lx:l.x,ly:l.y,
      quality,
      agreement,
      poseX:(eyeA.x+eyeB.x)/2,
      poseY:bridge.y,
      faceScale
    };

    if(raw.x<-.35||raw.x>1.35||raw.y<-.7||raw.y>1.7)return null;

    let minX=1,maxX=0,minY=1,maxY=0;
    this.eyePoints=[];
    for(const id of EYE_IDS){
      const p=lms[id];
      minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
      minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
      this.eyePoints.push({x:p.x,y:p.y});
    }
    this.eyeBox={minX,maxX,minY,maxY};
    return raw;
  }
  cheapProbe(){
    if(video.readyState<2||!video.videoWidth)return 0;
    let sx=video.videoWidth*.2,sy=video.videoHeight*.18,sw=video.videoWidth*.6,sh=video.videoHeight*.4;
    if(this.eyeBox){
      const x1=this.eyeBox.minX*video.videoWidth,x2=this.eyeBox.maxX*video.videoWidth,y1=this.eyeBox.minY*video.videoHeight,y2=this.eyeBox.maxY*video.videoHeight;
      const ew=x2-x1,eh=y2-y1;sx=clamp(x1-ew*.35,0,video.videoWidth-1);sy=clamp(y1-eh*1.15,0,video.videoHeight-1);sw=clamp(ew*1.7,1,video.videoWidth-sx);sh=clamp(eh*3.3,1,video.videoHeight-sy);
    }
    probeCtx.drawImage(video,sx,sy,sw,sh,0,0,128,48);const data=probeCtx.getImageData(0,0,128,48).data,gray=new Uint8Array(128*48);
    for(let i=0,j=0;i<data.length;i+=4,j++)gray[j]=(data[i]*.299+data[i+1]*.587+data[i+2]*.114)|0;
    let score=0;if(this.prevProbe){let sum=0;for(let i=0;i<gray.length;i++)sum+=Math.abs(gray[i]-this.prevProbe[i]);score=sum/gray.length/255}this.prevProbe=gray;return score;
  }
  update(now,force=false){
    if(!this.landmarker||video.readyState<2||video.currentTime===this.lastVideoTime)return;
    this.lastVideoTime=video.currentTime;this.framesSeen++;this.motionScore=this.cheapProbe();
    if(this.motionScore>=MOTION_ENTER)this.moving=true;
    else if(this.moving&&this.motionScore<=MOTION_EXIT){this.moving=false;this.landingUntil=Math.max(this.landingUntil,now+470)}
    let interval;
    const mobileSlow=MOBILE_DEVICE&&this.avgInferenceMs>34;
    const mobileVerySlow=MOBILE_DEVICE&&this.avgInferenceMs>46;
    if(force){
      this.precisionHz=MOBILE_DEVICE?(mobileSlow?24:30):30;
      interval=1000/this.precisionHz;this.mode="CALIBRATE";
    }
    else if(this.moving){
      this.precisionHz=MOBILE_DEVICE?8:8;
      interval=1000/this.precisionHz;this.mode="FLIGHT";
    }
    else if(now<this.landingUntil){
      this.precisionHz=MOBILE_DEVICE?(mobileSlow?24:30):30;
      interval=1000/this.precisionHz;this.mode="LANDING";
    }
    else{
      this.precisionHz=MOBILE_DEVICE?(mobileVerySlow?18:mobileSlow?21:24):24;
      interval=1000/this.precisionHz;this.mode="HOLD";
    }
    if(force||now-this.lastPrecision>=interval){
      this.lastPrecision=now;this.precisionPasses++;
      let result;
      const inferStart=performance.now();
      try{result=this.landmarker.detectForVideo(video,now)}
      catch(e){console.warn("detectForVideo failed",e);return}
      const inferMs=Math.max(0,performance.now()-inferStart);
      this.avgInferenceMs=this.avgInferenceMs?this.avgInferenceMs*.88+inferMs*.12:inferMs;

      if(result.faceLandmarks?.length){
        const raw=this.extract(result.faceLandmarks[0]);
        const qualityOk=raw&&(!MOBILE_DEVICE||(raw.quality??1)>.16);
        if(qualityOk){
          this.faceFound=true;this.lastFace=now;
          if(this.raw&&this.lastRawTime){
            const dt=Math.max(.001,(now-this.lastRawTime)/1000);
            this.velocity=Math.hypot(raw.x-this.raw.x,raw.y-this.raw.y)/dt;
            if(this.velocity>GAZE_SACCADE_SPEED)this.landingUntil=Math.max(this.landingUntil,now+370)
          }
          this.raw=raw;this.lastRawTime=now
        }
      }else{this.faceFound=false;this.eyePoints=[]}
    }else if(now-this.lastFace>850)this.faceFound=false;
  }
  drawPreview(){
    if(!this.stream||video.readyState<2||$("cameraCard").classList.contains("preview-hidden"))return;
    previewCtx.clearRect(0,0,256,144);previewCtx.drawImage(video,0,0,256,144);
    if(this.eyeBox){previewCtx.strokeStyle="#75f7ed";previewCtx.lineWidth=1.3;previewCtx.strokeRect(this.eyeBox.minX*256,this.eyeBox.minY*144,(this.eyeBox.maxX-this.eyeBox.minX)*256,(this.eyeBox.maxY-this.eyeBox.minY)*144)}
    previewCtx.fillStyle="#fff0a0";for(const p of this.eyePoints){previewCtx.beginPath();previewCtx.arc(p.x*256,p.y*144,1.2,0,Math.PI*2);previewCtx.fill()}
  }
  get processingRatio(){return this.framesSeen?this.precisionPasses/this.framesSeen:0}
}

class CalibrationFlow{
  constructor(){this.reset()}
  reset(){this.index=0;this.elapsed=0;this.current=[];this.samples=[]}
  get count(){return MOBILE_DEVICE?21:15}

  points(){
    const t=TOPBAR();
    const side=MOBILE_DEVICE?clamp(W*.085,28,58):W*.12;
    const L=side,R=W-side,C=.50*W;
    const vpad=MOBILE_DEVICE?(H<520?48:clamp(H*.085,62,88)):105;
    const T=t+vpad,B=H-vpad,M=(T+B)/2;

    if(!MOBILE_DEVICE){
      const L2=.31*W,R2=.69*W;
      return[
        [C,M],
        [L,T],[L2,T],[C,T],[R2,T],[R,T],
        [R,M],[R,B],[R2,B],[C,B],[L2,B],[L,B],
        [L,M],[L2,M],[R2,M]
      ];
    }

    const xs=Array.from({length:7},(_,i)=>L+(R-L)*(i/6));
    const rows=[T,M,B];
    const all=[];
    for(const y of rows)for(const x of xs)all.push([x,y]);

    // Center and major anchors first; remaining points fill the local map.
    const preferred=[
      [C,M],[L,T],[R,T],[R,B],[L,B],
      [L,M],[R,M],[C,T],[C,B]
    ];
    const result=[...preferred];
    for(const p of all){
      if(!result.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<2))result.push(p);
    }
    return result.slice(0,21);
  }

  targetPx(){
    const pts=this.points(),p=pts[Math.min(this.index,pts.length-1)];
    return{x:p[0],y:p[1]};
  }

  robustPoint(){
    if(this.current.length<5)return null;
    const med=arr=>{const a=[...arr].sort((x,y)=>x-y);return a[(a.length/2)|0]};
    const mx=med(this.current.map(p=>p.x)),my=med(this.current.map(p=>p.y));
    const madX=Math.max(.0015,med(this.current.map(p=>Math.abs(p.x-mx))));
    const madY=Math.max(.0015,med(this.current.map(p=>Math.abs(p.y-my))));
    let kept=this.current.filter(p=>
      Math.abs(p.x-mx)<=3*madX&&
      Math.abs(p.y-my)<=3*madY&&
      (p.quality??1)>.16
    );
    if(kept.length<3)kept=this.current;

    const field=k=>med(kept.map(p=>Number.isFinite(p[k])?p[k]:0));
    return{
      x:field("x"),y:field("y"),
      rx:field("rx"),ry:field("ry"),
      lx:field("lx"),ly:field("ly"),
      quality:field("quality"),
      poseX:field("poseX"),poseY:field("poseY"),faceScale:field("faceScale")
    };
  }

  placePoint(){
    const p=this.targetPx();
    $("calPoint").style.left=p.x+"px";$("calPoint").style.top=p.y+"px";
    $("calCounter").textContent=`${Math.min(this.index+1,this.count)} / ${this.count}`;
    $("calProgress").style.width=`${(this.index/this.count)*100}%`;
  }

  update(dt,raw,found){
    if(!found||!raw||this.index>=this.count)return false;
    this.elapsed+=dt;

    const settle=MOBILE_DEVICE?.15:.22;
    const duration=MOBILE_DEVICE?.64:.78;
    if(this.elapsed>settle && (raw.quality??1)>.12)this.current.push({...raw});

    if(this.elapsed>=duration){
      const rp=this.robustPoint(),target=this.targetPx();
      if(rp)this.samples.push({raw:rp,sx:target.x/W,sy:target.y/H});
      this.current=[];this.elapsed=0;this.index++;
      this.placePoint();
      return this.index>=this.count;
    }
    return false;
  }
}

class ValidationFlow{
  constructor(){this.reset()}
  reset(){this.index=0;this.elapsed=0;this.current=[];this.records=[]}
  get count(){return MOBILE_DEVICE?9:5}

  points(){
    const t=TOPBAR();
    const vpad=MOBILE_DEVICE?(H<520?56:clamp(H*.10,70,98)):125;
    const side=MOBILE_DEVICE?clamp(W*.13,42,82):W*.18;
    const T=t+vpad,B=H-vpad,L=side,R=W-side,C=.5*W,M=(T+B)/2;

    if(!MOBILE_DEVICE)return[[C,M],[L,T],[R,T],[R,B],[L,B]];
    return[
      [C,M],[L,T],[R,T],[R,B],[L,B],
      [C,T],[R,M],[C,B],[L,M]
    ];
  }

  targetPx(){
    const pts=this.points(),p=pts[Math.min(this.index,pts.length-1)];
    return{x:p[0],y:p[1]};
  }

  robustRaw(){
    if(this.current.length<4)return null;
    const med=arr=>{const a=[...arr].sort((x,y)=>x-y);return a[(a.length/2)|0]};
    const keys=["x","y","rx","ry","lx","ly","quality","poseX","poseY","faceScale"];
    const out={};
    for(const k of keys)out[k]=med(this.current.map(p=>Number.isFinite(p[k])?p[k]:0));
    return out;
  }

  placePoint(){
    const p=this.targetPx();
    $("calPoint").style.left=p.x+"px";$("calPoint").style.top=p.y+"px";
    $("calCounter").textContent=`TUNE ${Math.min(this.index+1,this.count)} / ${this.count}`;
    $("calProgress").style.width=`${(this.index/this.count)*100}%`;
  }

  update(dt,raw,found,model){
    if(!found||!raw||this.index>=this.count)return false;
    this.elapsed+=dt;
    const settle=MOBILE_DEVICE?.13:.18;
    const duration=MOBILE_DEVICE?.48:.58;
    if(this.elapsed>settle && (raw.quality??1)>.12)this.current.push({...raw});

    if(this.elapsed>=duration){
      const rr=this.robustRaw(),target=this.targetPx();
      if(rr)this.records.push({raw:rr,sx:target.x/W,sy:target.y/H});
      this.current=[];this.elapsed=0;this.index++;
      this.placePoint();
      return this.index>=this.count;
    }
    return false;
  }
}

class AudioBank{
  constructor(){this.ctx=null}
  unlock(){try{if(!this.ctx)this.ctx=new(AudioContext||webkitAudioContext)();if(this.ctx.state==="suspended")this.ctx.resume()}catch(_){}}
  tone(freq,d=.07,v=.04,type="sine"){if(!this.ctx)return;const n=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(v,n+.007);g.gain.exponentialRampToValueAtTime(.0001,n+d);o.connect(g).connect(this.ctx.destination);o.start(n);o.stop(n+d+.01)}
  hit(c){this.tone(c>=4?980:660+(Math.min(c,4)-1)*80,.075,.045,"triangle")}cache(){this.tone(520,.10,.038)}bad(){this.tone(150,.13,.045,"sawtooth")}overdrive(){this.tone(420,.07,.035);setTimeout(()=>this.tone(630,.08,.04),70);setTimeout(()=>this.tone(900,.11,.045),145)}
}

class Particles{
  constructor(){this.items=[]}
  burst(x,y,color,count=18){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=rand(55,210);this.items.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.35,.75),max:1,r:rand(1.5,4),color})}}
  update(dt){for(const p of this.items){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.985;p.life-=dt}this.items=this.items.filter(p=>p.life>0)}
  draw(){for(const p of this.items){ctx.save();ctx.globalAlpha=clamp(p.life/.6,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.restore()}}
}

class Game{
  constructor(){this.reset(0)}

  reset(now){
    this.score=0;
    this.combo=0;
    this.bestCombo=0;
    this.timeLeft=ROUND_SECONDS;
    this.gates=0;
    this.perfect=0;
    this.nearMisses=0;
    this.boosts=0;
    this.snapTurns=0;
    this.lastSnap=false;
    this.shield=3;
    this.dead=false;

    this.shipX=0;
    this.shipY=0;
    this.vx=0;
    this.vy=0;
    this.steerX=0;
    this.steerY=0;
    this.bank=0;
    this.pitch=0;
    this.speed=9.5;
    this.maxSpeed=this.speed;
    this.distance=0;
    this.shake=0;
    this.flash=0;
    this.lastGateAt=now;
    this.lastSpawnZ=34;
    this.routeIndex=0;
    this.boostUntil=0;
    this.pendingLock=null;

    this.pathX=0;
    this.pathY=0;
    this.objects=[];
    this.stars=[];
    this.spawnTimer=0;

    // Give the player an immediate readable route.
    for(let i=0;i<7;i++)this.spawnGate(18+i*13,i===3);
    for(let i=0;i<8;i++)this.spawnDebris(24+i*10);
  }

  spawnGate(z=this.lastSpawnZ+13,boost=false){
    const drift=.34;
    this.pathX=clamp(this.pathX+rand(-drift,drift),-1.00,1.00);
    this.pathY=clamp(this.pathY+rand(-drift*.72,drift*.72),-.72,.72);
    this.objects.push({
      type:boost?"boost":"gate",
      x:this.pathX,
      y:this.pathY,
      z,
      r:boost?.62:.72,
      passed:false,
      phase:rand(0,Math.PI*2)
    });
    this.routeIndex++;
    this.lastSpawnZ=Math.max(this.lastSpawnZ,z);
  }

  spawnDebris(z=this.lastSpawnZ+rand(7,13)){
    const side=Math.random()<.5?-1:1;
    const nearPath=Math.random()<.58;
    let x=nearPath?this.pathX+rand(-.86,.86):side*rand(.85,1.45);
    let y=nearPath?this.pathY+rand(-.68,.68):rand(-.92,.92);
    x=clamp(x,-1.55,1.55);
    y=clamp(y,-1.05,1.05);
    this.objects.push({
      type:"debris",
      x,y,z,
      r:rand(.18,.30),
      rot:rand(0,Math.PI*2),
      spin:rand(-1.4,1.4),
      checked:false
    });
  }

  controlFromGaze(gaze){
    if(!gaze)return{x:0,y:0};
    const top=TOPBAR();
    const usable=Math.max(1,H-top);
    let x=(gaze.x/W-.5)*2;
    let y=((gaze.y-top)/usable-.5)*2;

    // A small central neutral area makes steady forward flight possible.
    const dead=.055;
    const shape=v=>{
      const s=Math.sign(v),a=Math.abs(v);
      if(a<dead)return 0;
      const n=(a-dead)/(1-dead);
      return s*Math.pow(clamp(n,0,1),1.18);
    };
    return{x:shape(clamp(x,-1,1)),y:shape(clamp(y,-1,1))};
  }

  update(dt,now,gaze,gazeSpeed,mode,ok){
    if(this.dead)return;
    if(!ok||!gaze){
      this.vx*=Math.pow(.12,dt);
      this.vy*=Math.pow(.12,dt);
      this.bank*=Math.pow(.08,dt);
      return;
    }

    this.timeLeft=Math.max(0,this.timeLeft-dt);
    const input=this.controlFromGaze(gaze);
    const snap=gazeSpeed>GAZE_SACCADE_SPEED;
    if(snap&&!this.lastSnap){this.snapTurns++;this.lastSnap=true}
    else if(gazeSpeed<GAZE_SACCADE_SPEED*.52)this.lastSnap=false;

    const fine=(mode==="LANDING"||mode==="HOLD");
    const response=fine?5.6:8.8;
    this.steerX+=(input.x-this.steerX)*(1-Math.exp(-response*dt));
    this.steerY+=(input.y-this.steerY)*(1-Math.exp(-response*dt));

    // Fast gaze changes give decisive bank authority; settled gaze gives finer trim.
    const turnPower=snap?4.8:(fine?3.2:3.9);
    const damping=fine?4.8:3.9;
    this.vx+=(this.steerX*turnPower-this.vx*damping)*dt;
    this.vy+=(this.steerY*turnPower*.82-this.vy*damping)*dt;

    this.shipX=clamp(this.shipX+this.vx*dt,-1.48,1.48);
    this.shipY=clamp(this.shipY+this.vy*dt,-1.02,1.02);

    this.bank+=(clamp(-this.vx*.34,-.48,.48)-this.bank)*(1-Math.exp(-5*dt));
    this.pitch+=(clamp(-this.vy*.22,-.24,.24)-this.pitch)*(1-Math.exp(-4.5*dt));

    const difficulty=1+(ROUND_SECONDS-this.timeLeft)/ROUND_SECONDS*.36;
    const boosting=now<this.boostUntil;
    const targetSpeed=(boosting?15.8:10.1)*difficulty;
    this.speed+=(targetSpeed-this.speed)*(1-Math.exp(-(boosting?2.6:1.1)*dt));
    this.maxSpeed=Math.max(this.maxSpeed,this.speed);
    this.distance+=this.speed*dt;

    // Keep the route extending ahead of the player.
    let farthest=0;
    for(const o of this.objects)farthest=Math.max(farthest,o.z);
    while(farthest<116){
      const boostGate=(this.routeIndex%6===4);
      this.spawnGate(farthest+rand(11,15),boostGate);
      farthest=this.lastSpawnZ;
      if(Math.random()<.86)this.spawnDebris(farthest-rand(4,9));
    }

    for(const o of this.objects){
      o.z-=this.speed*dt;
      if(o.type==="debris")o.rot+=o.spin*dt;

      if(o.passed||o.z>1.05)continue;

      const dx=this.shipX-o.x,dy=this.shipY-o.y;
      const d=Math.hypot(dx,dy);

      if(o.type==="gate"||o.type==="boost"){
        const hit=d<o.r*.72;
        if(hit){
          this.gates++;
          this.combo++;
          this.bestCombo=Math.max(this.bestCombo,this.combo);

          const perfect=d<o.r*.25;
          if(perfect)this.perfect++;

          let gained=160+Math.min(500,(this.combo-1)*35)+(perfect?160:0);
          if(o.type==="boost"){
            this.boosts++;
            this.boostUntil=now+3.8;
            gained+=280;
            toast("BOOST",900);
            audio.overdrive();
            particles.burst(W/2,H*.52,"#c7ff58",18);
          }else{
            toast(perfect?"PERFECT GATE":"GATE",650);
            audio.hit();
          }
          this.score+=gained;
          this.lastGateAt=now;
        }else{
          this.combo=0;
        }
        o.passed=true;
      }else if(o.type==="debris"&&!o.checked){
        const collision=d<o.r+.13;
        if(collision){
          this.shield--;
          this.combo=0;
          this.score=Math.max(0,this.score-260);
          this.shake=Math.max(this.shake,.85);
          this.flash=.85;
          audio.bad();
          toast(this.shield>0?"IMPACT":"AIRFRAME LOST",900);
          particles.burst(W/2,H*.56,"#ff625b",24);
          if(this.shield<=0)this.dead=true;
        }else if(d<o.r+.36){
          this.nearMisses++;
          this.score+=90;
          toast("NEAR MISS +90",650);
        }
        o.checked=true;
        o.passed=true;
      }
    }

    this.objects=this.objects.filter(o=>o.z>-4);
    this.shake=Math.max(0,this.shake-dt*2.4);
    this.flash=Math.max(0,this.flash-dt*2.7);
  }
}

const tracker=new Tracker(),calibrationModel=new CalibrationModel(),cal=new CalibrationFlow(),validation=new ValidationFlow(),audio=new AudioBank(),particles=new Particles(),game=new Game();
const gazeFilterX=new OneEuro1D(1.45,.50,1),gazeFilterY=new OneEuro1D(1.32,.44,1);
let mouseMode=false,smoothed=null,prevSmoothed=null,prevGazeTime=performance.now(),gazeSpeed=0,startDwell=0,lastFrame=performance.now(),mouse={x:W/2,y:H/2},loopStarted=false,previewVisible=true,pausedByHidden=false,gazeTrail=[];
let readyTuneSamples=[],readyTuneElapsed=0,readyAutoTuned=false;

function resetGazeFilters(){
  gazeFilterX.reset();gazeFilterY.reset();
  smoothed=null;prevSmoothed=null;gazeSpeed=0;
  prevGazeTime=performance.now();gazeTrail=[];
}

function robustRawMedian(samples){
  if(!samples.length)return null;
  const med=arr=>{const a=[...arr].sort((x,y)=>x-y);return a[(a.length/2)|0]};
  const keys=["x","y","rx","ry","lx","ly","quality","poseX","poseY","faceScale"];
  const out={};
  for(const k of keys)out[k]=med(samples.map(p=>Number.isFinite(p[k])?p[k]:0));
  return out;
}

async function startWebcam(){
  setState("LOADING");audio.unlock();
  try{
    if(location.protocol!=="https:"&&location.hostname!=="127.0.0.1"&&location.hostname!=="localhost")throw new Error("Camera access requires HTTPS. Open the hosted GitHub Pages site, or use localhost for local development.");
    if(!tracker.ready)await tracker.requestInitialCamera();
    if(!tracker.landmarker)await tracker.loadModel();
    mouseMode=false;
    calibrationModel.cx=calibrationModel.cy=null;calibrationModel.bias={x:0,y:0};
    tracker.raw=null;tracker.faceFound=false;tracker.eyeBox=null;tracker.eyePoints=[];tracker.prevProbe=null;
    cal.reset();validation.reset();smoothed=null;prevSmoothed=null;gazeTrail=[];
    setState("CALIBRATE");startLoop()
  }catch(e){
    console.error(e);
    if(tracker.stream && !tracker.landmarker){
      const failedStream=tracker.stream;
      tracker.stream=null;tracker.ready=false;tracker.faceFound=false;tracker.raw=null;
      failedStream.getTracks().forEach(t=>t.stop());
      $("cameraCard").classList.remove("visible","mobile-open");
    }
    const name=e?.name||"",msg=e?.message||String(e);
    if(name==="NotAllowedError"||name==="PermissionDeniedError")showError(
      "Camera permission was blocked",
      "The browser or operating system denied camera access.",
      MOBILE_DEVICE
        ? `<b>Phone fix:</b> open this site's browser permissions → allow Camera → reload → tap Play with front camera again. On iPhone/iPad, also check Safari/Chrome camera permission in Settings if needed.`
        : `<b>Fix:</b> click the camera/lock icon beside the address bar → allow Camera → choose the camera you want → Try again. You may also need to enable camera access in your operating-system privacy settings.`
    );
    else if(name==="NotFoundError"||name==="DevicesNotFoundError")showError("No camera was found","Make sure a camera is connected and enabled, then try again.",`Close apps that may own the camera (Zoom, Teams, OBS), close other camera apps, then press <b>Try again</b>.`);
    else if(name==="NotReadableError"||name==="TrackStartError")showError("The camera is busy","Another app may be using the selected camera.",`Close Zoom, Teams, OBS, Camera, or browser tabs using the webcam, then press <b>Try again</b>.`);
    else showError("Eye Flight couldn't start",msg,`Make sure you are online for the first load and use a current Chrome, Edge, Safari, or Chromium-family browser. Demo mode still works without the gaze model.`);
  }
}
function startMouse(){
  audio.unlock();
  if(tracker.stream){
    const oldStream=tracker.stream;
    tracker.stream=null;tracker.ready=false;tracker.faceFound=false;tracker.raw=null;
    oldStream.getTracks().forEach(t=>t.stop());
  }
  $("cameraCard").classList.remove("visible","mobile-open");
  mouseMode=true;
  smoothed={x:.5,y:.5};prevSmoothed={...smoothed};gazeTrail=[];
  setState("READY");
  startLoop();
}
function startLoop(){if(loopStarted)return;loopStarted=true;lastFrame=performance.now();requestAnimationFrame(loop)}

function placeReadyTarget(){const p={x:W/2,y:TOPBAR()+(H-TOPBAR())*.52};$("readyTarget").style.left=p.x+"px";$("readyTarget").style.top=p.y+"px"}
function getScreenGaze(now){
  let norm=null,ok=true;
  if(mouseMode){
    norm={x:clamp(mouse.x/W,0,1),y:clamp(mouse.y/H,0,1)};
  }else if(calibrationModel.ready&&tracker.raw){
    norm=calibrationModel.map(tracker.raw);
    ok=tracker.faceFound&&calibrationModel.poseStable(tracker.raw);
  }else ok=tracker.faceFound;

  if(norm){
    if(MOBILE_DEVICE&&!mouseMode){
      // One Euro filtering cuts small-phone cursor jitter while allowing fast
      // gaze jumps to pass through with much less lag than fixed smoothing.
      const t=now/1000;
      const filtered={
        x:gazeFilterX.filter(norm.x,t),
        y:gazeFilterY.filter(norm.y,t)
      };
      smoothed=filtered;
    }else{
      let rawSpeed=0;
      if(smoothed){
        const dt=Math.max(.001,(now-prevGazeTime)/1000);
        rawSpeed=Math.hypot(norm.x-smoothed.x,norm.y-smoothed.y)/dt;
      }
      let a=clamp(.17+rawSpeed*.20,.17,.72);
      if(!mouseMode&&tracker.mode==="LANDING")a=Math.max(a,.46);
      if(!smoothed)smoothed={...norm};
      else{
        smoothed.x+=(norm.x-smoothed.x)*a;
        smoothed.y+=(norm.y-smoothed.y)*a;
      }
    }

    if(prevSmoothed){
      const dt=Math.max(.001,(now-prevGazeTime)/1000);
      gazeSpeed=Math.hypot(smoothed.x-prevSmoothed.x,smoothed.y-prevSmoothed.y)/dt;
    }
    prevSmoothed={...smoothed};
    prevGazeTime=now;
  }

  const gaze=smoothed?{x:smoothed.x*W,y:smoothed.y*H}:null;
  const cursor=$("gazeCursor");
  if(cursor){
    const shouldShow=!!gaze&&(state==="READY"||state==="PLAY");
    cursor.classList.toggle("visible",shouldShow);
    cursor.classList.toggle("lost",shouldShow&&!ok);
    if(gaze){
      cursor.style.left=`${gaze.x}px`;
      cursor.style.top=`${gaze.y}px`;
    }
  }

  return{gaze,ok};
}
function roundRectPath(c,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);
  c.beginPath();
  c.moveTo(x+rr,y);
  c.arcTo(x+w,y,x+w,y+h,rr);
  c.arcTo(x+w,y+h,x,y+h,rr);
  c.arcTo(x,y+h,x,y,rr);
  c.arcTo(x,y,x+w,y,rr);
  c.closePath();
}

function flightHorizon(){
  const usable=Math.max(1,H-TOPBAR());
  return TOPBAR()+usable*(.47+game.pitch*.52);
}

function projectFlight(x,y,z){
  const depth=Math.max(.72,z);
  const focal=Math.min(W,H)*1.18;
  const horizon=flightHorizon();
  return{
    x:W*.5+(x-game.shipX)*focal/depth*1.72,
    y:horizon+(y-game.shipY)*focal/depth*1.72,
    s:focal/depth
  };
}

function drawGrid(now){
  ctx.clearRect(0,0,W,H);

  const top=TOPBAR();
  const horizon=top+(H-top)*.48;

  const sky=ctx.createLinearGradient(0,top,0,horizon);
  sky.addColorStop(0,"#122333");
  sky.addColorStop(.62,"#39586a");
  sky.addColorStop(1,"#8f8b78");
  ctx.fillStyle=sky;
  ctx.fillRect(0,top,W,Math.max(0,horizon-top));

  const ground=ctx.createLinearGradient(0,horizon,0,H);
  ground.addColorStop(0,"#292923");
  ground.addColorStop(.32,"#171918");
  ground.addColorStop(1,"#090a0b");
  ctx.fillStyle=ground;
  ctx.fillRect(0,horizon,W,H-horizon);

  // Sun.
  ctx.save();
  ctx.globalAlpha=.72;
  ctx.fillStyle="#f4e7bd";
  ctx.beginPath();
  ctx.arc(W*.73,horizon-(H-top)*.16,Math.min(W,H)*.035,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Distant ridge line.
  ctx.save();
  ctx.fillStyle="#202520";
  ctx.beginPath();
  ctx.moveTo(0,horizon+18);
  for(let x=0;x<=W;x+=24){
    const y=horizon-12-Math.sin(x*.012)*13-Math.sin(x*.027+1.8)*8;
    ctx.lineTo(x,y);
  }
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
  ctx.restore();

  // Quiet cloud bands.
  ctx.save();
  ctx.globalAlpha=.11;
  ctx.fillStyle="#ffffff";
  for(let i=0;i<7;i++){
    const x=((i*173+now*.004)% (W+260))-130;
    const y=top+45+(i%3)*48;
    ctx.beginPath();
    ctx.ellipse(x,y,72+18*(i%2),12+3*(i%3),0,0,Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFlightGate(o,now){
  const p=projectFlight(o.x,o.y,o.z);
  if(p.s<2||p.s>800)return;
  const r=o.r*p.s;
  if(r<2)return;

  const boost=o.type==="boost";
  const color=boost?"#c7ff58":"#f0e7c8";
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(Math.sin(o.phase+now*.0012)*.035);

  ctx.strokeStyle=boost?"rgba(199,255,88,.24)":"rgba(240,231,200,.14)";
  ctx.lineWidth=Math.max(2,r*.12);
  ctx.beginPath();ctx.arc(0,0,r*1.10,0,Math.PI*2);ctx.stroke();

  ctx.strokeStyle=color;
  ctx.lineWidth=Math.max(2.2,r*.055);
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();

  // Four small orientation ticks make depth readable without a HUD box.
  ctx.lineWidth=Math.max(1.4,r*.026);
  for(let i=0;i<4;i++){
    ctx.save();ctx.rotate(i*Math.PI/2);
    ctx.beginPath();ctx.moveTo(r*1.04,0);ctx.lineTo(r*1.20,0);ctx.stroke();
    ctx.restore();
  }

  if(boost&&r>20){
    ctx.fillStyle="#c7ff58";
    ctx.globalAlpha=.92;
    ctx.font=`800 ${Math.max(9,Math.min(16,r*.18))}px Inter,system-ui,sans-serif`;
    ctx.textAlign="center";
    ctx.fillText("BOOST",0,4);
  }
  ctx.restore();
}

function drawDebris(o){
  const p=projectFlight(o.x,o.y,o.z);
  if(p.s<2||p.s>900)return;
  const r=o.r*p.s;
  if(r<2)return;

  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(o.rot);
  ctx.fillStyle="#413b37";
  ctx.strokeStyle="#ff625b";
  ctx.lineWidth=Math.max(1.2,r*.075);

  ctx.beginPath();
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7;
    const rr=r*(.78+.20*Math.sin(i*2.17+o.rot));
    const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.fill();ctx.stroke();

  ctx.strokeStyle="rgba(255,98,91,.35)";
  ctx.lineWidth=Math.max(1,r*.025);
  ctx.beginPath();ctx.moveTo(-r*.45,-r*.08);ctx.lineTo(r*.40,r*.18);ctx.stroke();
  ctx.restore();
}

function drawGuideToGate(){
  const gate=game.objects
    .filter(o=>(o.type==="gate"||o.type==="boost")&&!o.passed&&o.z>2)
    .sort((a,b)=>a.z-b.z)[0];
  if(!gate)return;
  const p=projectFlight(gate.x,gate.y,gate.z);
  const margin=54;
  if(p.x>margin&&p.x<W-margin&&p.y>TOPBAR()+margin&&p.y<H-margin)return;

  const cx=clamp(p.x,margin,W-margin);
  const cy=clamp(p.y,TOPBAR()+margin,H-margin);
  const angle=Math.atan2(p.y-H*.5,p.x-W*.5);

  ctx.save();
  ctx.translate(cx,cy);ctx.rotate(angle);
  ctx.fillStyle=gate.type==="boost"?"#c7ff58":"#f0e7c8";
  ctx.globalAlpha=.88;
  ctx.beginPath();
  ctx.moveTo(12,0);ctx.lineTo(-7,-7);ctx.lineTo(-4,0);ctx.lineTo(-7,7);ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCockpit(){
  const top=TOPBAR();
  const usable=H-top;
  const y=H-1;

  ctx.save();
  ctx.fillStyle="rgba(5,6,7,.92)";
  ctx.beginPath();
  ctx.moveTo(0,y);
  ctx.lineTo(0,H-usable*.19);
  ctx.lineTo(W*.12,H-usable*.10);
  ctx.lineTo(W*.31,H);
  ctx.closePath();ctx.fill();

  ctx.beginPath();
  ctx.moveTo(W,y);
  ctx.lineTo(W,H-usable*.19);
  ctx.lineTo(W*.88,H-usable*.10);
  ctx.lineTo(W*.69,H);
  ctx.closePath();ctx.fill();

  // Nose reference.
  ctx.strokeStyle="rgba(243,241,235,.42)";
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(W*.5-24,H-30);ctx.lineTo(W*.5-8,H-30);ctx.lineTo(W*.5,H-23);
  ctx.lineTo(W*.5+8,H-30);ctx.lineTo(W*.5+24,H-30);
  ctx.stroke();

  // Shield pips.
  const sx=18,sy=H-28;
  for(let i=0;i<3;i++){
    ctx.fillStyle=i<game.shield?"#c7ff58":"rgba(255,255,255,.13)";
    roundRectPath(ctx,sx+i*17,sy,12,5,2.5);ctx.fill();
  }
  ctx.restore();
}

function drawSpeedLines(now){
  if(now/1000>=game.boostUntil)return;
  ctx.save();
  ctx.strokeStyle="rgba(199,255,88,.28)";
  ctx.lineWidth=1.2;
  for(let i=0;i<28;i++){
    const a=i*2.399+now*.0005;
    const r1=Math.min(W,H)*(.22+(i%5)*.035);
    const r2=r1+36+(i%4)*18;
    const cx=W*.5,cy=flightHorizon();
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1*.62);
    ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2*.62);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGame(gaze,ok,now){
  const shake=game.shake>0?game.shake*5:0;
  const jx=shake?Math.sin(now*.081)*shake:0;
  const jy=shake?Math.cos(now*.067)*shake*.6:0;

  ctx.save();
  ctx.translate(jx,jy);

  drawGrid(now);

  const horizon=flightHorizon();
  ctx.save();
  ctx.translate(W*.5,horizon);
  ctx.rotate(game.bank*.68);
  ctx.translate(-W*.5,-horizon);

  // Ground speed streaks.
  ctx.save();
  ctx.strokeStyle="rgba(240,231,200,.055)";
  ctx.lineWidth=1;
  for(let i=0;i<18;i++){
    const x=(i/17)*W;
    ctx.beginPath();
    ctx.moveTo(W*.5+(x-W*.5)*.10,horizon+8);
    ctx.lineTo(x,H);
    ctx.stroke();
  }
  ctx.restore();

  const ordered=[...game.objects].sort((a,b)=>b.z-a.z);
  for(const o of ordered){
    if(o.z<.6)continue;
    if(o.type==="debris")drawDebris(o);
    else drawFlightGate(o,now);
  }

  ctx.restore();

  drawSpeedLines(now);
  drawGuideToGate();
  particles.draw();
  drawCockpit();

  // Minimal flight readout.
  ctx.save();
  ctx.font="700 10px Inter,system-ui,sans-serif";
  ctx.fillStyle="rgba(243,241,235,.72)";
  ctx.fillText(`${Math.round(game.distance*10)} m`,18,TOPBAR()+28);
  ctx.textAlign="right";
  ctx.fillText(`${Math.round(game.speed*68)} km/h`,W-18,TOPBAR()+28);
  ctx.restore();

  if(!ok&&!mouseMode){
    const msg=(MOBILE_DEVICE&&tracker.faceFound&&calibrationModel.poseStable&&!calibrationModel.poseStable(tracker.raw))
      ?"Hold the phone steady":"Can't see your eyes";
    ctx.save();
    ctx.font="700 11px Inter,system-ui,sans-serif";
    const w=ctx.measureText(msg).width+34;
    const x=(W-w)/2,y=H-66;
    ctx.fillStyle="rgba(11,11,12,.82)";
    ctx.strokeStyle="rgba(255,98,91,.42)";
    roundRectPath(ctx,x,y,w,34,17);ctx.fill();ctx.stroke();
    ctx.textAlign="center";ctx.fillStyle="#ff9a95";ctx.fillText(msg,W/2,y+21);
    ctx.restore();
  }

  if(game.flash>0){
    ctx.fillStyle=`rgba(255,98,91,${game.flash*.18})`;
    ctx.fillRect(0,TOPBAR(),W,H-TOPBAR());
  }

  ctx.restore();
}
function updateHUD(){
  $("score").textContent=String(game.score).padStart(6,"0");
  $("combo").textContent=`x${Math.max(1,game.combo)}`;
  $("timer").textContent=game.timeLeft.toFixed(1);

  const mode=mouseMode?(gazeSpeed>GAZE_SACCADE_SPEED?"FLIGHT":"LANDING"):tracker.mode;
  const friendlyMode={
    FLIGHT:"TURN",
    LANDING:"AIM",
    HOLD:"CRUISE",
    CALIBRATE:"SETUP",
    IDLE:"READY"
  }[mode]||mode;

  $("sensorMode").textContent=friendlyMode;
  $("sensorMode").dataset.mode=mode;
  $("precisionRate").textContent="SPEED";
  $("skipRate").textContent=`${Math.round(game.speed*68)} km/h`;

  if(state==="PLAY"&&$("statePill"))$("statePill").textContent=nowBoosting()?"BOOST":"FLYING";

  const remain=Math.max(0,game.boostUntil-performance.now()/1000);
  const active=state==="PLAY"&&remain>0;
  $("overdriveBadge").classList.toggle("visible",active);
  $("overdriveTime").textContent=remain.toFixed(1);
}
function nowBoosting(){
  return performance.now()/1000<game.boostUntil;
}
function updateCalibration(dt){
  $("calWarning").classList.toggle("visible",!tracker.faceFound);
  const done=cal.update(dt,tracker.raw,tracker.faceFound);
  if(done){
    if(calibrationModel.fit(cal.samples)){
      smoothed=null;prevSmoothed=null;
      validation.reset();
      setState("VALIDATE");
    }else{
      cal.reset();toast("Calibration was noisy — retrying.",1400);
    }
  }
}

function updateValidation(dt){
  $("calWarning").classList.toggle("visible",!tracker.faceFound);
  const done=validation.update(dt,tracker.raw,tracker.faceFound,calibrationModel);
  if(done){
    if(MOBILE_DEVICE)calibrationModel.refine(validation.records);
    const q=calibrationModel.applyValidation(validation.records);
    const px=q==null?null:Math.round(q*Math.hypot(W,H));
    $("qualityLabel").textContent=q==null
      ?"SETUP COMPLETE"
      :q<.035?"ACCURACY EXCELLENT":q<.055?"ACCURACY GOOD":q<.085?"ACCURACY OK":"TRY RECENTER IF NEEDED";
    $("qualityText").textContent=px==null
      ?"Look at the center and hold to begin."
      :`Estimated setup error ≈ ${px}px. If the cursor feels consistently offset, look at center and press R.`;
    smoothed=null;prevSmoothed=null;
    rememberCalibrationViewport();
    setState("READY");
  }
}
function updateReady(dt,gaze,ok){
  const target={x:W/2,y:TOPBAR()+(H-TOPBAR())*.52};
  const targetNorm={x:target.x/W,y:target.y/H};

  // Final mobile micro-tune: the READY screen has one explicit instruction —
  // look at the center. Use a short stable sample there to cancel the last
  // global offset that is very noticeable on a small phone screen.
  if(
    MOBILE_DEVICE&&!mouseMode&&!readyAutoTuned&&
    tracker.faceFound&&tracker.raw&&gaze
  ){
    const d=dist(gaze,target)/Math.max(1,Math.hypot(W,H));
    if(d<.24 && (tracker.raw.quality??1)>.18){
      readyTuneElapsed+=dt;
      readyTuneSamples.push({...tracker.raw});
      if(readyTuneSamples.length>24)readyTuneSamples.shift();
    }else{
      readyTuneElapsed=Math.max(0,readyTuneElapsed-dt*1.4);
      if(readyTuneElapsed===0)readyTuneSamples=[];
    }

    if(readyTuneElapsed>=.46&&readyTuneSamples.length>=6){
      const rr=robustRawMedian(readyTuneSamples);
      if(rr){
        calibrationModel.recenter(rr,targetNorm);
        readyAutoTuned=true;
        readyTuneSamples=[];readyTuneElapsed=0;startDwell=0;
        resetGazeFilters();
        toast("CENTER TUNED",900);
        return;
      }
    }
  }

  const radius=MOBILE_DEVICE?Math.max(74,Math.min(W,H)*.19):118;
  if(gaze&&ok&&dist(gaze,target)<radius)startDwell+=dt;
  else startDwell=Math.max(0,startDwell-dt*1.8);

  const progress=clamp(startDwell/(MOBILE_DEVICE?.68:.78),0,1);
  $("readyProgress").style.setProperty("--p",`${progress*360}deg`);

  if(progress>=1){
    game.reset(performance.now()/1000);
    startDwell=0;
    setState("PLAY");
    toast("AIRBORNE");
  }
}
function finish(){
  setState("GAMEOVER");
  $("finalScore").textContent=String(game.score).padStart(6,"0");
  $("statLocks").textContent=game.gates;
  $("statChain").textContent=`x${game.bestCombo}`;
  $("statSaccades").textContent=game.nearMisses;
  $("statCaches").textContent=game.boosts;
  $("statOverdrives").textContent=game.perfect;
  $("statPrecision").textContent=mouseMode?"—":tracker.precisionPasses;
  $("adaptiveSummary").textContent=
    `${Math.round(game.distance*10)} m flown · max ${Math.round(game.maxSpeed*68)} km/h · ${game.shield>0?game.shield+" shield left":"airframe lost"}`;
}
function loop(now){
  const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
  if(!mouseMode&&tracker.ready)tracker.update(now,state==="CALIBRATE"||state==="VALIDATE");
  if(!mouseMode)tracker.drawPreview();
  const {gaze,ok}=getScreenGaze(now);
  particles.update(dt);

  if(state==="CALIBRATE")updateCalibration(dt);
  else if(state==="VALIDATE")updateValidation(dt);
  else if(state==="READY")updateReady(dt,gaze,ok);
  else if(state==="PLAY"&&!pausedByHidden){
    const mode=mouseMode?(gazeSpeed>GAZE_SACCADE_SPEED?"FLIGHT":"LANDING"):tracker.mode;
    game.update(dt,now/1000,gaze,gazeSpeed,mode,ok);
    if(!mouseMode&&game.pendingLock){
      calibrationModel.adaptFromLock(game.pendingLock.gaze,game.pendingLock.target);
      game.pendingLock=null;
    }
    drawGame(gaze,ok,now);
    if(game.timeLeft<=0||game.dead)finish();
  }else drawGrid(now);

  updateHUD();requestAnimationFrame(loop);
}

$("startBtn").addEventListener("click",startWebcam);$("mouseBtn").addEventListener("click",startMouse);$("errorMouseBtn").addEventListener("click",startMouse);$("retryBtn").addEventListener("click",startWebcam);$("loadingBackBtn").addEventListener("click",()=>setState("INTRO"));
$("cameraSelect").addEventListener("change",async e=>{
  try{
    await tracker.switchCamera(e.target.value);
    $("cameraCard").classList.remove("mobile-open");
  }catch(err){
    showError("Couldn't switch cameras",err.message,"Make sure the selected camera is available and not in use by another app, then try again.");
  }
});
$("togglePreviewBtn").addEventListener("click",()=>{previewVisible=!previewVisible;$("cameraCard").classList.toggle("preview-hidden",!previewVisible);$("togglePreviewBtn").textContent=previewVisible?"−":"+";$("togglePreviewBtn").setAttribute("aria-label",previewVisible?"Hide camera preview":"Show camera preview")});
$("mobileCamBtn").addEventListener("click",()=>{
  const card=$("cameraCard");
  card.classList.toggle("mobile-open");
});
$("calRestartBtn").addEventListener("click",()=>{cal.reset();validation.reset();smoothed=null;prevSmoothed=null;setState("CALIBRATE");toast("Calibration restarted")});
$("replayBtn").addEventListener("click",()=>{audio.unlock();game.reset(performance.now()/1000);setState("PLAY")});
$("recalibrateBtn").addEventListener("click",()=>{if(mouseMode){setState("READY");return}calibrationModel.cx=calibrationModel.cy=null;cal.reset();validation.reset();smoothed=null;prevSmoothed=null;setState("CALIBRATE")});
addEventListener("mousemove",e=>{mouse={x:e.clientX,y:e.clientY}});
addEventListener("pointermove",e=>{
  if(mouseMode && e.pointerType==="touch"){
    mouse={x:e.clientX,y:e.clientY};
  }
},{passive:true});
addEventListener("pointerdown",e=>{
  if(mouseMode && e.pointerType==="touch"){
    mouse={x:e.clientX,y:e.clientY};
  }
},{passive:true});
addEventListener("keydown",e=>{
  if(e.key==="m"||e.key==="M"){
    if(mouseMode){
      startWebcam();
    }else{
      startMouse();
      toast(MOBILE_DEVICE?"TOUCH DEMO":"DEMO MODE");
    }
  }
  if((e.key==="c"||e.key==="C")&&!mouseMode&&tracker.ready){calibrationModel.cx=calibrationModel.cy=null;cal.reset();validation.reset();smoothed=null;prevSmoothed=null;setState("CALIBRATE")}
  if((e.key==="r"||e.key==="R")&&!mouseMode&&tracker.ready&&calibrationModel.ready&&tracker.raw){calibrationModel.recenter(tracker.raw,{x:.5,y:.5});smoothed=null;prevSmoothed=null;toast("QUICK RECENTER APPLIED",1200)}
  if(e.key==="f"||e.key==="F"){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()}
  if(e.key==="p"||e.key==="P")$("togglePreviewBtn").click()
});
let calibratedOrientation=null;
function currentOrientationKey(){
  return W>=H?"landscape":"portrait";
}
function rememberCalibrationViewport(){
  calibratedOrientation=currentOrientationKey();
}
function invalidateForOrientationChange(){
  if(!MOBILE_DEVICE || !calibrationModel.ready || !calibratedOrientation)return;
  if(currentOrientationKey()!==calibratedOrientation && state!=="CALIBRATE" && state!=="VALIDATE"){
    calibrationModel.cx=calibrationModel.cy=null;
    calibrationModel.bias={x:0,y:0};
    cal.reset();validation.reset();smoothed=null;prevSmoothed=null;gazeTrail=[];
    setState("CALIBRATE");
    toast("SCREEN ROTATED — RECALIBRATE",1800);
  }
}
addEventListener("orientationchange",()=>setTimeout(invalidateForOrientationChange,250));
if(window.screen?.orientation){
  window.screen.orientation.addEventListener?.("change",()=>setTimeout(invalidateForOrientationChange,250));
}

document.addEventListener("visibilitychange",()=>{pausedByHidden=document.hidden;if(pausedByHidden&&state==="PLAY")toast("PAUSED — RETURN TO TAB",1400);lastFrame=performance.now()});
if(MOBILE_DEVICE){
  const startButton=$("startBtn");
  if(startButton){
    startButton.innerHTML='<span>Play with front camera</span><small>precision phone setup</small>';
  }
  const fallback=$("mouseBtn");
  if(fallback){
    fallback.innerHTML='<span>Try demo with touch</span><small>no camera required</small>';
  }
}
window.__eyeFlightBooted=true;
drawGrid(performance.now());updateHUD();
