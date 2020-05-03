
//express 연동
const express = require('express')
//socket.io 연동
var io = require('socket.io')
  ({
    path: '/webrtc'
  })


//server 생성(express + socket.io)
const app = express()
//포트 번호 8080번으로 초기화
const port = 8080
//react project의 build파일을 static하게 실행(front는 react를 통해 연동)
app.use(express.static(__dirname + '/build'))
app.get('/', (req, res, next) => {
  res.sendFile(__dirname + '/build/index.html')
})
//서버 실행 로그 띄우기(port는 8080번)
const server = app.listen(port, () => console.log(`${port}포트에서 화상회의 application이 실행됩니다!`))
//web server는 socket.io에 의하여 실시간통신됨
io.listen(server)
// default namespace
io.on('connection', socket => {
  //connection 성공시 참여 log 띄우기
  console.log('client가 화상회의 참여합니다')
})

//socket.io path를 통해 들어온 client peers로 설정
const peers = io.of('/webrtcPeer')
//web에 연결된 peers에 대한 정보를 connectedPeers 정보로 저장
let connectedPeers = new Map()
//peers가 web에 connection이 되면 
peers.on('connection', socket => {
  //connectPeers에 connection된 peers의 socket 정보 추가
  connectedPeers.set(socket.id, socket)
  //server상에 connection된 peer의 socket id 띄우기
  console.log('참여한 peer의 socket.id : ', socket.id)
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
  socket.on('disconnect', () => {
    console.log('client가 화상회의에서 퇴장합니다')
    //connectedPeers 변수에서 퇴장한 peer의 socket.id 삭제
    connectedPeers.delete(socket.id)
    //disconnected 된 peer 정보 전송(peer에게)
    disconnectedPeer(socket.id)
  })
  socket.on('message', (data) => {
    console.log(`${data}`)
    socket.broadcast.emit('message', { text: data })
  })
  //server에서 onlinePeers에 대한 정보 수신 받으면
  socket.on('onlinePeers', (data) => {
    for (const [socketID, _socket] of connectedPeers.entries()) {
      // 자기 자신(local)이 아니라면(remote peer일 떄)
      if (socketID !== data.socketID.local) {
        //online peer에 대한 정보 출력
        console.log('online-peer', data.socketID, socketID)
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
      if (socketID === data.socketID.remote) {
        //offer peer의 socket 정보 출력
        console.log('Offer', socketID, data.socketID, data.payload.type)
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
        console.log('Answer', socketID, data.socketID, data.payload.type)
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
    for (const [socketID, socket] of connectedPeers.entries()) {
      // 자기 자신(local)이 아니라면(remote peer일 떄)
      if (socketID == data.socketID.remote) {
        //candidate 연결할 peer의 socket 정보 출력
        console.log(socketID, data.payload)
        //candidate,sockeID 전송(offer peer와 answer peer간에 connection이 완료됨)
        socket.emit('candidate', {
          candidate: data.payload,
          socketID: data.socketID.local,
          channel: data.channel
        })
      }
    }
  })
})