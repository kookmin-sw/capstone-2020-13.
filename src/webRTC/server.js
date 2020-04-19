//express server 생성
const express = require('express')
//socket.io 연동
var io = require('socket.io')
({
  path: '/webrtc'
})
const app = express()
//포트 번호 8080번으로 초기화
const port = 8080
//react project의 build파일을 static하게 실행(front는 react를 통해 연동)
app.use(express.static(__dirname + '/build'))
app.get('/', (req, res, next) => {
    res.sendFile(__dirname + '/build/index.html')
})
//terminal에 서버 실행 로그 띄우기
const server = app.listen(port, () => console.log(`${port}포트에서 화상회의 application이 실행됩니다!`))
//server는 socket.io에 의하여 실시간통신됨
io.listen(server)

// default namespace
io.on('connection', socket => {
  //connection 연결시 참석 log 
  console.log('client가 화상회의 참여합니다')
})
//peers 정보
const peers = io.of('/webrtcPeer')

//모든 socket 연결에 대한 정보 저장
let connectedPeers = new Map()

//client가 web에 connection이 되면 terminal에 연결성공 log와 socket.id띄우기
peers.on('connection', socket => {
  //connectPeers에 client의 socket.id 추가
  connectedPeers.set(socket.id, socket)
  console.log('참여한 client의 socket.id : ',socket.id)
  //peer에게 연결 성공 log 전송
  socket.emit('connection-success', { 
    success: socket.id,
    peerCount: connectedPeers.size,
  })
  //connectedPeers의 사이즈를 통해 몇명의 peer가 참석해있는지 전송(peer에게)
  const broadcast = () => socket.broadcast.emit('joined-peers', {
    peerCount: connectedPeers.size,
  })
  broadcast()
  
  //disconnected 된 peer 정보 전송(peer에게)
   const disconnectedPeer = (socketID) => socket.broadcast.emit('peer-disconnected', {  
     socketID: socketID
  })

  //client가 web에 disconnection이 되면 terminal에 연결해제 log와 그 client의 socket.id를 connectedPeers에서 삭제
  socket.on('disconnect', () => {
    console.log('client가 화상회의에서 퇴장합니다')
    connectedPeers.delete(socket.id)
    disconnectedPeer(socket.id)
  })

  socket.on('onlinePeers', (data) => {
    for (const [socketID, _socket] of connectedPeers.entries()) {
      // 자기 자신에게 보내면 안됨(remote peer일 경우에만 online-peer 전송)
      if (socketID !== data.socketID.local) {
        console.log('online-peer', data.socketID, socketID)
        socket.emit('online-peer', socketID)
      }
    }
  })

  socket.on('offer', (data) => {
    //connectedPeers의 목록에 해당되는 socket의 정보가 있을때
    for (const [socketID, socket] of connectedPeers.entries()) {
      // 자기 자신에게 보내면 안됨(remote peer일 경우에만 offer 전송)
      if (socketID === data.socketID.remote) {
        //offer peer의 socket 정보 추출
        console.log('Offer', socketID, data.socketID, data.payload.type)
        //offer peer의 sdp정보 전송
        socket.emit('offer', {
            sdp: data.payload,
            socketID: data.socketID.local
          }
        )
      }
    }
  })

   socket.on('answer', (data) => {
    //connectedPeers의 목록에 해당되는 socket의 정보가 있을때
    for (const [socketID, socket] of connectedPeers.entries()) {
      // 자기 자신에게 보내면 안됨(remote peer일 경우에만 answer 전송)
      if (socketID === data.socketID.remote) {
        //answer peer의 socket 정보 추출
        console.log('Answer', socketID, data.socketID, data.payload.type)
        //answer peer의 sdp정보 전송
        socket.emit('answer', {
            sdp: data.payload,
            socketID: data.socketID.local
          }
        )
      }
    }
  }) 

  
  socket.on('candidate', (data) => {
    for (const [socketID, socket] of connectedPeers.entries()) {
      // 다른 peer가 연결 될 경우(remote socketID)
      if (socketID == data.socketID.remote) {
        //candidate 연결할 peer의 socket 정보 추출
        console.log(socketID, data.payload)
        //candidate 전송하기
        socket.emit('candidate', {
          candidate: data.payload,
          socketID: data.socketID.local
        })
      }
    }
  })

})