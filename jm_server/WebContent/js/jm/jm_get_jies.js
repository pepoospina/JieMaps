function get_jie_from_keyw() {
	var q = document.getElementById('jie_query');
	var jies = get_jie_data_from_server(q.value);
};

function get_jie_data_from_server(keyw) {
	$.ajax({
		type : 'POST',
		url : '../jm_ser/ctr/Controller',
		data : {
			"keyw" : keyw,
			"action_code" : 101
		},
		dataType : "json",

		success : function(data, textStatus, jqXHR) {
			if(data) {
				receive_jie_list(data.jie_list,WJ_GLOBAL_jie_map);
			}
		}
	});
};

function send_jie_data_to_server(new_jies_str) {
	$.ajax({
		type : 'POST',
		url : '../jm_ser/ctr/Controller',
		data : {
			"new_jies" : new_jies_str,
			"action_code" : 201
		},
		dataType : "json",

		success : function(data, textStatus, jqXHR) {
			if(data) {
				//
			}
		}
	});
};

function receive_jie_list(jie_list_json,jie_map) {
	
	jie_map.clear();
	
	var jie_list = json_to_js(jie_list_json);
	
	jie_map.set_jies(jie_list);
	
	jie_map.place_init();
	jie_map.layout_force();
	jie_map.froze();
	jie_map.draw();
	
}

function json_to_js(generic_json) {
	
	var nodes_ids = new Array(); 
	var nodes_store = new Array();
	var urls_ids = new Array(); 	
	var urls_store = new Array();

	var new_jies = new Array();
	
	for (var jie_ix in generic_json) {
		
		var jie = generic_json[jie_ix];
		var new_nodes = new Array();
		
		for (var node_ix in jie.nodes) {
			
			var node = jie.nodes[node_ix];
			
			var new_urls = new Array();
			
			for (url_ix in node.urls) {
				var url = node.urls[url_ix];
				var curr_index_url = urls_ids.indexOf(url.id);
				if(curr_index_url == -1){
					var new_url = new UrlObj(url.id,url.url);
					urls_ids.push(new_url.id);
					urls_store.push(new_url);
				} else {
					var new_node = nodes_store[curr_index_url];
				}
				
				new_urls.push(new_url);
			}
			
			var curr_index_node = nodes_ids.indexOf(node.id);
			if(curr_index_node == -1){
				var new_node = new NodeObj(node.id,node.title,node.desc,new_urls);	
				nodes_ids.push(new_node.id);
				nodes_store.push(new_node);
			} else {
				var new_node = nodes_store[curr_index_node];
			}
			
			new_nodes.push(new_node);
		}
		
		var new_jie = new JieObj(jie.id,jie.title,jie.desc,new_nodes);
		new_jies.push(new_jie);
	}
	
	return new_jies;
};


function js_to_json(js_jie_list) {
	
	var jie_list_json = new Array();
	
	for (var jie_ix in js_jie_list) {
		
		var this_jie = js_jie_list[jie_ix];
		var new_nodes = new Array();
		
		for (var node_ix in this_jie.nodes) {
			
			var this_node = this_jie.nodes[node_ix];
			var new_urls = new Array();
			
			for (url_ix in this_node.urls) {
				var this_url = this_node.urls[url_ix];
					
				var new_url = new UrlObjBasic(0,this_url.url);
				new_urls.push(new_url);
			}
			
			var new_node = new NodeObjBasic(0,this_node.title,this_node.desc,new_urls);
			new_nodes.push(new_node);
		}
		
		var new_jie = new JieObj(0,this_jie.title,this_jie.desc,new_nodes);
		jie_list_json.push(new_jie);
	}
	
	return jie_list_json;	
}
