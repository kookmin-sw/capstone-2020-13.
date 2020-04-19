import React, { Component } from 'react';
import io from 'socket.io-client'
import Video from './components/video'
import Videos from './components/videos'

class App extends Component {
  constructor(props) {
    super(props)    
    this.state={
      //새로운 offer가 생길 때마다 stream을 update하는 것을
      //방지하기 위해 localstream 변수로 관리
      localStream : null,
      //메인 화면에서 remote stream 객체를 고정하기 위해 사용
      remoteStream : null, 
      //모든 remote stream 객체들을 유지
      remoteStreams : [],
      //모든 peer connection을 유지
      peerConnections : {},
      //선택된 video(확대 할 video)를 null로 초기화
      selectedVideo : null,
      //webRTC 제공 STUN서버 이용
      pc_config : {
        "iceServers": [
        {
          urls : 'stun:stun.l.google.com:19302'
        }
        ]
      },

      sdpConstraints: {
        'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': true
        }
      },
    }
    //ngrok을 통해 localhost를 공용 IP로 배포(수시로 바뀜, ngrok의 경우 12시간 유효)
    this.serviceIP = 'https://0682cbf9.ngrok.io/webrtcPeer'
    //socket 초기화
    this.socket = null
  }

  getLocalStream = () => {
    //연결 성공시
    const success = (stream) => {
      window.localStream = stream
      this.setState({
        localStream: stream
      })
       this.whoisOnline()
    }
    //연결 실패시 
    const failure = (e) => {
      console.log('getUserMedia Error: ', e)
    }
    //audio, video 제약 조건(화상회의 옵션)
    const constraints = {
      audio: false,
      video: true,
      options : {
        mirror: true,
      }
    }
    
    navigator.mediaDevices.getUserMedia(constraints)
      .then(success)
      .catch(failure)
  }

  whoisOnline = () => {
    //모든 peer들에게 자신(접속된 peer)의 정보를 전송
    this.sendToPeer('onlinePeers', null, {local: this.socket.id})
  }

  sendToPeer = (messageType, payload, socketID) => {
    this.socket.emit(messageType, {
      socketID,
      payload
    })
  }

createPeerConnection = (socketID, callback) => {
    try {
      let pc = new RTCPeerConnection(this.state.pc_config)
      // peerConnection 객체에 pc 추가하기
      const peerConnections = { ...this.state.peerConnections, [socketID]: pc }
      this.setState({
        peerConnections
      })

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendToPeer('candidate', e.candidate, {
            local: this.socket.id,
            remote: socketID
          })
        }
      }

      pc.oniceconnectionstatechange = (e) => {
      }

      pc.ontrack = (e) => {
        const remoteVideo = {
          id: socketID,
          name: socketID,
          stream: e.streams[0]
        }

        this.setState(prevState => {
          // stream이 있다면 유지, 없을시 최신의 stream 사용
          const remoteStream = prevState.remoteStreams.length > 0 ? {} : { remoteStream: e.streams[0] }
          // 현재 선택된 비디오 얻기
          let selectedVideo = prevState.remoteStreams.filter(stream => stream.id === prevState.selectedVideo.id)
          // 비디오가 리스트에 있다면 유지, 없다면 새로운 video stream으로 세팅
          selectedVideo = selectedVideo.length ? {} : { selectedVideo: remoteVideo }
          return {
            // selectedVideo: remoteVideo,
            ...selectedVideo,
            // remoteStream: e.streams[0],
            ...remoteStream,
            remoteStreams: [...prevState.remoteStreams, remoteVideo]
          }
        })
      }
      pc.close = () => {
        // alert('GONE')
      }
      if (this.state.localStream)
        pc.addStream(this.state.localStream)
      // pc를 return
      callback(pc)

    } catch(e) {
      //pc를 못불러 왔을때는 error 메세지 출력하기
      console.log('PC가 생성되지 않았습니다', e)
      // return
      callback(null)
    }
  }
  componentDidMount = () => {
    this.socket = io.connect(
      //ngrok 서버를 통해 socket 연결이 됨
      this.serviceIP,
      {
        path: '/webrtc',
        query: {}
      }
    )
    //client의 화면에 띄어짐
    // client가 연결에 성공하면 연결 성공 띄우기
    this.socket.on('connection-success', data => {
      //getLocalStream method 호출을 통해 자신의 stream 가져오기
      this.getLocalStream()
      console.log(data.success)
      })
    //client가 연결 해제되면 연결 해제 띄우기
    this.socket.on('peer-disconnected', data =>{
      console.log('peer-disconnected', data)
      const remoteStreams = this.state.remoteStreams.filter(stream => stream.id !== data.socketID)
      this.setState(prevState => {
        // 연결 해제된 peer가 selected video라면 다른 remote video를 selected video로 선택
        const selectedVideo = prevState.selectedVideo.id === data.socketID && remoteStreams.length ? { selectedVideo: remoteStreams[0] } : null
        return {
          remoteStreams,
          ...selectedVideo,
        }
        }
      )
    })
    this.socket.on('online-peer', socketID => {
      //연결된 peer에 대한 정보 출력해주기
      console.log('connected peers ...', socketID)
      // 새로운 pc 생성
      this.createPeerConnection(socketID, pc => {
        // offer 생성해주기 
          if (pc)
            pc.createOffer(this.state.sdpConstraints)
              .then(sdp => {
                // pc의 sdp 정보를 local description으로 설정해주기
                pc.setLocalDescription(sdp)
                // offer(pc의 sdp 정보)를 다른 peer에게 전송해주기                 
                this.sendToPeer('offer', sdp, {
                  local: this.socket.id,
                  remote: socketID
                })
          })
        })
    })
    this.socket.on('offer', data => {
      this.createPeerConnection(data.socketID, pc => {
        pc.addStream(this.state.localStream)
        //다른 pc의 remote description에 전송받은 offer(sdp 정보)를 remote description으로 설정해주기
        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
          // answer 생성해주기
          pc.createAnswer(this.state.sdpConstraints)
            .then(sdp => {
              //해당 pc의 sdp 정보를 local description으로 설정해주기
              pc.setLocalDescription(sdp)
              //해당 pc로부터 생성된 answer(해당 pc의 sdp 정보)를 offer 요청 pc(peer)에게 전송해주기
              this.sendToPeer('answer', sdp, {
                local: this.socket.id,
                remote: data.socketID
              })
            })
        })
      })
    })
    this.socket.on('answer', data => {
      // remote의 peer connection 가져오기
      const pc = this.state.peerConnections[data.socketID]
      console.log(data.sdp)
      // 다른 pc로부터 전송받은 answer를 remote description으로 설정해주기 
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(()=>{})
    })


    this.socket.on('candidate', (data) => {
      // remote의 peer connection 가져오기
      const pc = this.state.peerConnections[data.socketID]
      if (pc)
        // candidate 정보에 추가해주기
        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
    })
  }
  switchVideo = (_video) => {
    console.log(_video)
    this.setState({
      selectedVideo: _video
    })
  }

  render() {
    
    console.log(this.state.localStream)

    return (
      <div>
        //local video
        <Video
          videoStyles={{
            zIndex:2,
            position: 'absolute',
            right:0,
            width: 200,
            height: 200,
            margin: 5,
            backgroundColor: 'black'
          }}          
          videoStream={this.state.localStream}
          autoPlay muted>
        </Video>
        //remote video(selected)
        <Video
          videoStyles={{
            zIndex: 1,
            position: 'fixed',
            bottom: 0,
            minWidth: '100%',
            minHeight: '100%',
            backgroundColor: 'black'
          }}          
          videoStream={this.state.selectedVideo && this.state.selectedVideo.stream}
          autoPlay>
        </Video>

        <br/>
        <div>
          //video 리스트들 출력(remote video들..)
          <Videos
            switchVideo={this.switchVideo}
            remoteStreams={this.state.remoteStreams}
          ></Videos>
        </div>
        <br/>        
      </div>
    )
  }
}

export default App;