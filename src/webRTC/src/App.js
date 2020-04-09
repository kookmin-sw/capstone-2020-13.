import React, { Component } from 'react';
import io from 'socket.io-client'

class App extends Component {
  constructor(props) {
    super(props)
    this.localVideoref = React.createRef()
    this.remoteVideoref = React.createRef()
    this.socket = null
    // candidate 정보 초기화(화상회의 참여자)
    this.candidates = []
  }
  componentDidMount = () => {
    this.socket = io(
      '/webrtcPeer',
      {
        path: '/webrtc',
        query: {}
      }
    )
    //client의 화면에 띄어짐

    // client가 연결에 성공하면 연결 성공 띄우기
    this.socket.on('connection-success', success => {
      console.log(success)
    })
    // 상대방으로 부터 sdp를 받았을시 받은 sdp를 상대방의 정보로 저장
    this.socket.on('offerOrAnswer', (sdp) => {
      this.textref.value = JSON.stringify(sdp)
      this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    })
    // 연결이 되었을시 candidate 정보에 추가해주기
    this.socket.on('candidate', (candidate) => {
      this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    })

    const pc_config = {
      "iceServers": [
        {
          urls : 'stun:stun.l.google.com:19302'
        }
      ]
    }
     //peer connection 생성
    this.pc = new RTCPeerConnection(pc_config)
    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendToPeer('candidate', e.candidate)
      }
    }
    this.pc.oniceconnectionstatechange = (e) => {
      console.log(e)
    }
    this.pc.onaddstream = (e) => {
      this.remoteVideoref.current.srcObject = e.stream
    }
    const success = (stream) => {
      window.localStream = stream
      this.localVideoref.current.srcObject = stream
      this.pc.addStream(stream)
    }

    const failure = (e) => {
      console.log('getUserMedia Error: ', e)
    }
    const constraints = {
      audio: false,
      video: true,
      // video: {
      //   width: 1280,
      //   height: 720
      // },
      // video: {
      //   width: { min: 1280 },
      // }
    }
    navigator.mediaDevices.getUserMedia(constraints)
      .then(success)
      .catch(failure)
  }
  sendToPeer = (messageType, payload) => {
    this.socket.emit(messageType, {
      socketID: this.socket.id,
      payload
    })
  }

  //peer 1 기준
  createOffer = () => {
    console.log('Offer')
    // sdp 초기화
    this.pc.createOffer({ offerToReceiveVideo: 1 })
      .then(sdp => {
        // offer sdp를 localdescription으로 저장
        this.pc.setLocalDescription(sdp)
        // 상대 peer에거 sdp 정보 전달
        this.sendToPeer('offerOrAnswer', sdp)
    })
  }
  //peer 2 기준
  createAnswer = () => {
    console.log('Answer')
    this.pc.createAnswer({ offerToReceiveVideo: 1 })
      .then(sdp => {
        // answer sdp를 localdescription으로 저장
        this.pc.setLocalDescription(sdp)
        // 상대 peer에거 sdp 정보 전달
        this.sendToPeer('offerOrAnswer', sdp)
    })
  }
  setRemoteDescription = () => {
    // remote peer로부터 복사된 sdp를 parsing
    const desc = JSON.parse(this.textref.value)
    // sdp를 remotedescription으로 저장
    this.pc.setRemoteDescription(new RTCSessionDescription(desc))
  }

  addCandidate = () => {
    // remote peer로부터 복사된 candidate parsing
    // peer connection에 canidate정보 추가하기
    this.candidates.forEach(candidate => {
      console.log(JSON.stringify(candidate))
      this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    });
  }

  render() {
    return (
      <div>
        {/* client 화면에서 local video 띄우기 */}
        <video
          style={{
            width: 240,
            height: 240,
            margin: 5,
            backgroundColor: 'black'
          }}
          ref={ this.localVideoref }
          autoPlay>
        </video>

        {/* client 화면에서 remote video 띄우기 */}
        <video
          style={{
            width: 240,
            height: 240,
            margin: 5,
            backgroundColor: 'black'
          }}
          ref={ this.remoteVideoref }
          autoPlay>
        </video>
        <br />
        {/* Offer 버튼 생성 : 버튼 클릭시 createOffer method 실행 */}
        <button onClick={this.createOffer}>Offer</button>
        {/* Answer 버튼 생성 : 버튼 클릭시 createAnswer method 실행 */}
        <button onClick={this.createAnswer}>Answer</button>

        <br />
        {/* textarea 상에 sdp 정보가 교환됨 */}
        <textarea style={{ width: 450, height:40 }} ref={ref => { this.textref = ref }} />
      </div>
    )
  }
}
export default App;