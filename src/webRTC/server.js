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
//react project의 build파일을 static하게 실행
app.use(express.static(__dirname + '/build'))
app.get('/', (req, res, next) => {
    res.sendFile(__dirname + '/build/index.html')
})
//terminal에 서버 실행 로그 띄우기
const server = app.listen(port, () => console.log(`${port}포트에서 화상회의 application이 실행됩니다!`))
//server는 socket.io에 의하여 실시간통신됨
io.listen(server)

//peers 정보
const peers = io.of('/webrtcPeer')

//연결된 peers 정보 설정
let connectedPeers = new Map()

//client가 web에 connection이 되면 terminal에 연결성공 log와 socket.id띄우기
peers.on('connection', socket => {
  console.log('client가 화상회의 참여합니다')
  console.log('client의 socket.id : ',socket.id)
  socket.emit('connection-success', { success: socket.id })
  //connectPeers에 client의 socket.id 추가
  connectedPeers.set(socket.id, socket)
  
  //client가 web에 disconnection이 되면 terminal에 연결해제 log와 그 client의 socket.id를 connectedPeers에서 삭제
  socket.on('disconnect', () => {
    console.log('client가 화상회의에서 퇴장합니다')
    connectedPeers.delete(socket.id)
  })
  //OfferorAnswer 버튼을 client가 누르게 되면 client의 sdp의 정보가 띄어짐
  socket.on('offerOrAnswer', (data) => {
    for (const [socketID, socket] of connectedPeers.entries()) {
      if (socketID !== data.socketID) {
        console.log(socketID, data.payload.type)
        socket.emit('offerOrAnswer', data.payload)
      }
    }
  })
  //연결된 candiate의 정보가 terminal에 띄어짐
  socket.on('candidate', (data) => {
    for (const [socketID, socket] of connectedPeers.entries()) {
      if (socketID !== data.socketID) {
        console.log(socketID, data.payload)
        socket.emit('candidate', data.payload)
      }
    }
  })

})