import React, { Component } from 'react'
import annyang from './annyang'
import io from 'socket.io-client'


class Stt extends Component 
{
    constructor(props) 
    {
        super(props)
        this.state = {}
        this.converseSpeech = this.converseSpeech.bind(this)
        this.sendToChat = this.sendToChat.bind(this)
    }
    converseSpeech()
    {
        annyang.start({ autoRestart: false, continuous: true })
        var recognition = annyang.getSpeechRecognizer();
        var final_transcript = '';
        recognition.interimResults = true;
        recognition.onresult = function(event) 
        {
            var interim_transcript = '';
            final_transcript = '';
            for (var i = event.resultIndex; i < event.results.length; ++i) 
            {
                if (event.results[i].isFinal) 
                {
                    final_transcript += event.results[i][0].transcript;
                    console.log("final_transcript="+final_transcript);
                    //annyang.trigger(final_transcript); //If the sentence is "final" for the Web Speech API, we can try to trigger the sentence
                }
                else
                {
                    interim_transcript += event.results[i][0].transcript;
                    console.log("interim_transcript="+interim_transcript);
                }
            }
            document.getElementById('result').innerHTML =  '중간값:='+interim_transcript+'<br/>결과값='+final_transcript;
            console.log('interim='+interim_transcript+'|final='+final_transcript);
        }
        
    }

    sendToChat()
    {
    }

    
}
export default Stt
