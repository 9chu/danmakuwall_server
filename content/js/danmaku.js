function SendDanmaku()
{
	var dm_inputbox = $("#dm_content")[0];
	if(dm_inputbox.disabled == false) {
		if(dm_inputbox.value.length == 0) {
			$(".result_text").css("color", "#C00");
			$("#dm_result").html("请输入内容");
			$("#dm_content")[0].focus();
			return;
		}
		
		var color_data = $("#dm_color")[0].value;
		// 去掉开头的#
		if(color_data.length > 0 && color_data[0] == '#') {
			color_data = color_data.substring(1, color_data.length);
		}
		
		var dm_data = {
			"comment": dm_inputbox.value,
			"size": $("#dm_size")[0].selectedIndex,
			"type": $("#dm_style")[0].selectedIndex,
			"colorR": parseInt(color_data.substr(0, 2), 16),
			"colorG": parseInt(color_data.substr(2, 2), 16),
			"colorB": parseInt(color_data.substr(4, 2), 16)
		};
		
		// 禁用textbox并清空
		dm_inputbox.disabled = true;
		
		// 发送POST请求
		$.ajax({
			type: 'post',
			url: '/api/post_comment',
			data: dm_data,
			dataType: 'text',
			success: function(data) { 
				var result = data.result;
				if(result == "OK") {
					$(".result_text").css("color", "#390");
				}
				else {
					$(".result_text").css("color", "#C00");
				}
				
				$("#dm_result").html(result);
				$("#dm_content")[0].value = "";
				$("#dm_content")[0].disabled = false;
				$("#dm_content")[0].focus();
			},
			error: function(textStatus, errorThrown) {
				$(".result_text").css("color", "#C00");
				$("#dm_result").html("弹幕发送失败");
				$("#dm_content")[0].disabled = false;
				$("#dm_content")[0].focus();
			}
		});
	}
}
