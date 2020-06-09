// for web
const https = require('https')
const express = require('express')
const app = express()
const fs = require('fs')
const cors = require('cors');
const port = 3000

const socketIo = require("socket.io");
const server = https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
}, app)
  .listen(port, () => console.log(`running on ${port}`));
const io2 = socketIo(server)

app.use(cors());
//app.get('/',(req,res)=>{
//  res.status(200).json({"test":"test"});
//});

// for DB
const mongoose = require('mongoose');
// connect to db
mongoose.connect('mongodb+srv://chatDBMaster:dlawlghd12@clusterforchat-qj9sz.mongodb.net/test?retryWrites=true&w=majority');
let db = mongoose.connection
db.on('error', () => {
  //console.log('mongoose connection failed');
});
db.once('open', () => {
  //console.log('connected');
});
let chat = mongoose.Schema({
  roomNum: 'number',
  memberName: 'string',
  socketId: 'string',
  message: 'string',
  time: { type: Date, default: Date.now }
});
let ChatMessage = mongoose.model('Schema', chat);
let chattingLog = {}

let rooms = [];
let roomAndMembers = [];
//let io = require('socket.io')(server,{ path: '/webrtc' })//io.listen(server)

// socket communication
io2.on('connection', socket => {
  const { roomNum, memberName, memberId } = socket.request._query;
  if (!rooms.includes(roomNum)) {
    rooms.push(roomNum);
    // let fetch = require("node-fetch");
    // console.log(url);
    //console.log(`room create on ${roomNum},rooms: ${rooms.map(room=>room)}`);
  }
  const pos = roomAndMembers.findIndex(e => e.id === memberId && e.room === roomNum);
  if (pos === -1) {
    roomAndMembers.push({ id: memberId, room: roomNum });
    socket.join(roomNum);
  } else {
    // console.log("already connected");
    socket.emit('banned', () => { });
  }

  socket.on('chat', (data) => {
    //console.log('Received message!')
    var newChatMessage = new ChatMessage({ roomNum: roomNum, memberName: memberName, socketId: socket.id, message: data.message })
    newChatMessage.save(function (error, data) {
      if (error) {
        //console.log(error)
      }
      else {
        //console.log('Saved!')
      }
    })
    io2.sockets.in(roomNum).emit('chat', {
      message: data.message,
      memberName: memberName,
      socketID: socket.id
    })
  });

  socket.on('log', () => {
    ChatMessage.find({ roomNum: roomNum }, function (error, chat) {
      //console.log('—Read all—')
      if (error) console.error(error)
      else {
        //console.log(chat)
        //console.log(chat[0].message)
        chattingLog = JSON.stringify(chat)
        //io2.sockets.to(socket.id).emit('log', chattingLog)
        socket.emit('log', chattingLog)
      }
    })
  });
  // socket.on('disconnect',)
});

const peers = io2.of('/webrtcPeer')
//web에 연결된 peers에 대한 정보를 connectedPeers 정보로 저장
let connectedPeers = new Map()
//peers가 web에 connection이 되면 
peers.on('connection', socket => {
  //connectPeers에 connection된 peers의 socket 정보 추가
  connectedPeers.set(socket.id, socket)
  //server상에 connection된 peer의 socket id 띄우기
  // console.log('참여한 peer의 socket.id : ', socket.request._query, socket.id)
  const { memberId, roomNum } = socket.request._query;

  //peers에게 연결 성공 data 전송
  socket.emit('connection-success', {
    success: socket.id,
    peerCount: connectedPeers.size,
  })
  //broadcast 정의
  const broadcast = () => socket.broadcast.emit('joined-peers', {
    peerCount: connectedPeers.size,
  })
  //connectedPeers의 크기를 통해 참석한 peers의 숫자 전송(peers에게)
  broadcast()
  //disconnectedPeer 정의 
  const disconnectedPeer = (socketID) => socket.broadcast.emit('peer-disconnected', {
    socketID: socketID
  })

  //server에서 peers의 disconnect 수신 받으면 연결해제 log띄우기  
  //connectedPeers 변수에서 퇴장한 peer의 socket.id 삭제
  //disconnected 된 peer 정보 전송(peer에게)
  socket.on('disconnect', () => {
    // console.log('client가 화상회의에서 퇴장합니다', roomNum, memberId);
    connectedPeers.delete(socket.id);
    disconnectedPeer(socket.id);
    socket.leave(roomNum);
    const pos = roomAndMembers.findIndex(e => e.id === memberId && e.room === roomNum);
    pos > -1 ? roomAndMembers.splice(pos, 1) : null;
  })
  //server에서 onlinePeers에 대한 정보 수신 받으면
  socket.on('onlinePeers', (data) => {
    for (const [socketID, _socket] of connectedPeers.entries()) {
      // 자기 자신(local)이 아니라면(remote peer일 떄)
      if (socketID !== data.socketID.local && socket.request._query.roomNum === _socket.request._query.roomNum) {
        //online peer에 대한 정보 출력
        // if (socketID !== data.socketID.local) {
        // console.log('online-peer', data.socketID, socketID)
        //online peer에 대한 정보 peers에게 전송
        socket.emit('online-peer', socketID)
      }
    }
  })
  //server에서 offer event를 수신받으면
  socket.on('offer', (data) => {
    //connectedPeers에 해당되는 socket의 정보가 있을때
    for (const [socketID, socket] of connectedPeers.entries()) {
      // 자기 자신(local)이 아니라면(remote peer일 때)      
      // console.log(_socket.request._query.roomNum, socket.request._query.roomNum);
      if (socketID === data.socketID.remote) {
        //offer peer의 socket 정보 출력
        // console.log('Offer', socketID, data.socketID, data.payload.type)
        //offer peer의 sdp정보,socketID 전송(remote peer에게)
        socket.emit('offer', {
          sdp: data.payload,
          socketID: data.socketID.local
        }
        )
      }
    }
  })
  //server에서 answer event를 수신받으면
  socket.on('answer', (data) => {
    //connectedPeers에 해당되는 socket의 정보가 있을떄
    for (const [socketID, socket] of connectedPeers.entries()) {
      // 자기 자신(local)이 아니라면(remote peer일 떄)
      if (socketID === data.socketID.remote) {
        //answer peer의 socket 정보 출력
        // console.log('Answer', socketID, data.socketID, data.payload.type)
        //answer peer의 sdp정보,socketID 전송(offer 요청 peer에게)
        socket.emit('answer', {
          sdp: data.payload,
          socketID: data.socketID.local
        }
        )
      }
    }
  })
  //server에서 candidate event를 수신받으면  
  socket.on('candidate', (data) => {
    //connectedPeers에 해당되는 socket의 정보가 있을떄
    for (const [socketID, _socket] of connectedPeers.entries()) {
      // 자기 자신(local)이 아니라면(remote peer일 떄)
      if (socketID == data.socketID.remote) {
        const thumbnail = socket.request._query.thumbnail
        // console.log(thumbnail);
        setTimeout(() => { }, 1500);
        //candidate 연결할 peer의 socket 정보 출력
        // console.log(socketID, data.payload)
        //candidate,sockeID 전송(offer peer와 answer peer간에 connection이 완료됨)
        _socket.emit('candidate', {
          candidate: data.payload,
          socketID: data.socketID.local,
          thumbnail: thumbnail,
        })
      }
    }
  })
})

// routes
app.get('/', (req, res, next) => {
  res.status(200).json({ message: "this server for video conferencing. but, you have accessed wrong way :(" });
});

app.get('/checkRoom/:id', (req, res, next) => {
  const { id } = req.params;
  const found = roomAndMembers.filter(e => e.room === id);
  res.status(200).json({ exists: found.length ? true : false });
  // const found = rooms.includes(req.params.id);
  // res.status(200).json({ exists: found ? true : false });
});