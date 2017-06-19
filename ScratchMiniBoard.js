// This is an extension for development and testing of the Scratch Javascript Extension API.

(function(ext) {
    var UART_REV_FRAME_LEN=9;
    var device = null;

    var	FrameStep=0;
    var FrameBuf= new Uint8Array(300);
    var DataLen=0;
	

    var inputs = {
        'D1': 1,
        'D2': 2,
        'D3': 3,
        'D4': 4,
        'D5': 5,
        'D6': 6,
        'A1': 7,
        'A2': 8,
        'A3': 9
    };

    inputs['D1']=2;
	
    function getSensor(which) {
        return inputs[which];
    }
    

    
    function GetFrame(ch) {
	 //AA 95 4F FE FE FE BF 47 16
	 console.log('FrameStep: ' + FrameStep);
	 if(FrameStep>280)
		FrameStep=0; 
	//等待接收帧头    
        if(FrameStep==0){
		if(ch==0xaa){
			FrameStep=1;
			FrameBuf[0]=ch;
			console.log('GetFrame Head OK: ' + FrameBuf);
		}
	}
	//接收数据长度
	else if(FrameStep==1){  
	    	DataLen=ch&0x0f;
	    	FrameStep=2;
	    	FrameBuf[1]=ch;
	}
	else if((FrameStep>=2)&&(FrameStep<(2+DataLen))){
		FrameBuf[FrameStep]=ch;
		FrameStep++;
	}
	else if(FrameStep==(2+DataLen)){
		FrameBuf[FrameStep]=ch;
		var Sum=0;
		for(var i=0;i<(2+DataLen);i++){	
			Sum=Sum+FrameBuf[i];
		}
		if(ch!=Sum)
		{
			FrameStep=0;
			DataLen=0;
		}
		else
		{
			FrameStep++;
		}
	}
	else if(FrameStep==(3+DataLen)){   
	    	if(ch==0x16){
			
	    	}
	        else{
			FrameStep=0;
			DataLen=0;
		}	
	}
    }

    // Extension API interactions
    var potentialDevices = [];
    ext._deviceConnected = function(dev) {
        potentialDevices.push(dev);
        if (!device) {
            tryNextDevice();
        }
    }

    var watchdog = null;
    function tryNextDevice() {
        // If potentialDevices is empty, device will be undefined.
        // That will get us back here next time a device is connected.
        device = potentialDevices.shift();
        if (!device) return;

        device.open({ stopBits: 0, bitRate: 57600, parityBit:2, ctsFlowControl: 0 });
        device.set_receive_handler(function(data) {
	    clearTimeout(watchdog); 
            watchdog = null;
            console.log('Received: ' + data.byteLength);
            //放置接收的数据到环形缓冲区
            for(var i=0;i<data.byteLength;i++)
            {
			GetFrame(data[i]);  
            }
        });

        watchdog = setTimeout(function() {
            device.set_receive_handler(null);
            device.close();
            device = null;
            tryNextDevice();
        }, 5000);
    };
	
    ext.resetAll = function(){};	

    ext.sensor = function(which) { return getSensor(which); };	
	
    ext._deviceRemoved = function(dev) {
        if(device != dev) return;
        device = null;
    };

    ext._shutdown = function() {
        if(device) device.close();
        device = null;
    };

    ext._getStatus = function() {
        if(!device) return {status: 1, msg: 'ScratchMiniBoard disconnected'};
        if(watchdog) return {status: 1, msg: 'Probing for ScratchMiniBoard'};
        return {status: 2, msg: 'ScratchMiniBoard connected'};
    }

    var descriptor = {
        blocks: [
            [' ', '设置数字 %m.DigitalIOName 脚为 %m.DigitalIOmode', 'sensor', 'D1', '输入'],
            [' ', '输出 %m.DigitalIOOutType 电平到 数字 %m.DigitalIOName 脚', 'sensor', '低', 'D1'],
            ['r', '数字脚 %m.DigitalIOName 脚 输入电平', 'sensor', 'D1'],
            ['r', '模拟输入脚 %m.AnalogInPortName 脚 值', 'sensor', 'A1'],
            [' ', '输出 %n ms(周期),占空比 %n (0~100%) 信号到模拟输出脚 %m.AnalogIOName', 'sensor', 0,0,'PWM1']
        ],
        menus: {
            DigitalIOName:['D1','D2','D3','D4','D5','D6'],
  	    DigitalIOmode:['输入','输出'],
  	    DigitalIOOutType:['低','高'],
  	    AnalogInPortName:['A1','A2','A3'],
  	    AnalogOutPortName:['PWM1','PWM2']
        },
        url: 'https://abbottchen.github.io/test/ScratchMiniBoard.js'
    };
    ScratchExtensions.register('ScratchMiniBoard', descriptor, ext, {type: 'serial'});
})({});
