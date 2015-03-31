/**
 * 
 */
function Wj_Jie_Graph(init_scale) {

	this.nodes = new Array(); // array of nodes objects
	this.islands = null; // array of arrays of interconnected nodes
	this.links_jies = new Matrix(0, 0, 0); // matrix of links due to jies
	this.links_urls = null; // matrix of links due to shared urls

	this.cursor = null; // Placement cursor for init pos
	this.dft_dir = 0; // default direction for place init
	this.init_circle_vs_n_islands_x = [ 1,  4,  8,  16, 32, 64  ]; // init circle position vs n islands LUT X
	this.init_circle_vs_n_islands_y = [ 30, 30, 50, 60, 80, 100 ];; // init circle position vs n islands LUT Y
	this.dft_node_dist = 40*init_scale; // defaulte node distance for place init

	this.rel_dists_x = null; // matrix storing the relative distance X component between all nodes 
	this.rel_dists_y = null; // matrix storing the relative distance Y component between all nodes
	this.rel_dists_mod = null; // matrix storing the modulus of relative distances between all nodes
	
	this.rep_forces_x = null; // matrix storing the repulsive forces X component between all nodes
	this.rep_forces_y = null; // matrix storing the repulsive forces Y component between all nodes
	this.att_forces_x = null; // matrix storing the attractive forces X component between all nodes 
	this.att_forces_y = null; // matrix storing the attractive forces Y component between all nodes
	this.tor_forces_x = null; // vector storing the torsional forces X component of each node
	this.tor_forces_y = null; // vector storing the torsional forces Y component of each node
	
	this.total_forces_x = null; // vector storing the total summed forces X component of each node
	this.total_forces_y = null; // vector storing the total summed forces X component of each node

	this.epsilon_dist = 1;
	this.dist_scale = 20*init_scale; // nodes should have mean distance around this value
	this.node_mass = 1;
	this.n_steps = 100;
};

Wj_Jie_Graph.prototype.set_nodes = function(nodes) {
	// set nodes without verifying no repeating nodes are present
	this.nodes = new Array();
	
	for (var node_ix in nodes) {
		this.nodes.push(nodes[node_ix]);
	}
};

Wj_Jie_Graph.prototype.add_node = function(node,link_to) {

	// Check if the node is already present in the graph
	var this_ix_in_list = this.nodes.indexOf(node);
	
	var ix_added;
	
	if (this_ix_in_list == -1) {
		// add it if not present
		this.nodes.push(node);
		this.links_jies.add_empty_row_and_col();
		
		ix_added = this.nodes.length - 1
	} else {
		ix_added = this_ix_in_list;
	}
	
	// update the jie links using the link_to parameter
	if(link_to) {
		for(var it_link_to = 0; it_link_to < link_to.length; it_link_to++) {
			var this_link_to_ix = this.nodes.indexOf(link_to[it_link_to]);
			this.links_jies.set_value_sym(ix_added, this_link_to_ix,1);
		}
	}	

	// return the index of the node just added
	return ix_added;
	
};

Wj_Jie_Graph.prototype.add_nodes_and_links_from_jie = function(jie) {

	// go through the nodes and add each one of them together with 
	// the links associated with the jie
	for (node_ix in jie.nodes) {

		var this_node = jie.nodes[node_ix];
		var link_to = new Array();

		if (node_ix > 0) {
			// starting from the second node, every node in a jie 
			// has a link with the previous node.
			var prev_node = jie.nodes[node_ix - 1];
			link_to.push(prev_node);
		}
		
		this.add_node(this_node,link_to);
	}
};

Wj_Jie_Graph.prototype.update_nodes_and_links_from_jie_list = function(jie_list) {

	this.empty();
	
	for (jie_ix in jie_list) {
		this.add_nodes_and_links_from_jie(jie_list[jie_ix]);
	}
};

Wj_Jie_Graph.prototype.empty = function() {

	this.nodes = new Array();
	this.links_jies = new Matrix(0, 0, 0); // matrix of links due to jies
	 
};

Wj_Jie_Graph.prototype.froze = function() {
	// set nodes move_f property to 0
	for (var node_ix in this.nodes) {
		this.nodes[node_ix].graph.move_f = 0;
	}
};

Wj_Jie_Graph.prototype.place_init = function() {

	this.cursor = new Cursor([0,0], this.dft_dir);

	this.update_islands();
	this.place_islands();

};

Wj_Jie_Graph.prototype.get_n_nodes= function() {
	return this.nodes.length;	
}

Wj_Jie_Graph.prototype.get_links = function(node_ix) {

	var linked_nodes_ixs = new Array();

	var this_row = this.links_jies.get_row(node_ix);

	for (var ix_col = 0; ix_col < this_row.length; ix_col++) {
		if (this_row[ix_col] == 1) {
			linked_nodes_ixs.push(ix_col);
		}
	}

	return linked_nodes_ixs;
};

Wj_Jie_Graph.prototype.layout_force = function() {
	
	// layout simulation, computes the forces and 
	// moves the nodes
	
	for(var ix_step = 1; ix_step < this.n_steps; ix_step++) {
		
		// WJ_GLOBAL_jie_map.draw();	
		
		this.update_distances();
		this.zero_forces();
		
		this.update_all_rep_forces();
		this.update_all_att_forces();
		this.update_all_tor_forces();
				
		this.combine_all_forces();
		this.move();
	}
	
};

Wj_Jie_Graph.prototype.zero_forces = function() {
	
	var n_nodes = this.get_n_nodes();
	
	this.rep_forces_x = new Matrix(n_nodes,n_nodes,0);
	this.rep_forces_y = new Matrix(n_nodes,n_nodes,0);
	this.att_forces_x = new Matrix(n_nodes,n_nodes,0); 
	this.att_forces_y = new Matrix(n_nodes,n_nodes,0);
	this.tor_forces_x = new Matrix(n_nodes,n_nodes,0);
	this.tor_forces_y = new Matrix(n_nodes,n_nodes,0);
	
};

Wj_Jie_Graph.prototype.place_islands = function() {

	for (var ix_island in this.islands) {
		var this_island = this.islands[ix_island];
		var this_dir = ix_island * (2 * Math.PI / this.islands.length);
		var init_rad = wj_interpolate(	this.init_circle_vs_n_islands_x,
									this.init_circle_vs_n_islands_y, 
									this.islands.length,0);
		var this_pos = [ init_rad * Math.cos(this_dir),
		             init_rad * Math.sin(this_dir) ];
		this.place_island(this_island, this_pos, this_dir);
	}
};

Wj_Jie_Graph.prototype.place_island = function(island, pos, dir) {

	this.cursor.pos = pos;

	for (ix_node = 0; ix_node < island.length; ix_node++) {
		var this_node_ix = island[ix_node];

		this.nodes[this_node_ix].graph.pos[0] = this.cursor.pos[0];
		this.nodes[this_node_ix].graph.pos[1] = this.cursor.pos[1];

		var dir_random = Math.PI/180*wj_random(-1,1)*0;
		this.cursor.move(this.dft_node_dist, dir+dir_random);
	}
};

Wj_Jie_Graph.prototype.update_islands = function() {

	this.islands = new Array();

	var nodes_tocheck_ixs = wj_create_incremental_array(0,
			this.nodes.length - 1);

	nodes_tocheck_ixs.reverse();

	while (nodes_tocheck_ixs.length > 0) {

		start_node_ix = nodes_tocheck_ixs.pop();

		this_island_ixs = this.get_island(start_node_ix);
		this.islands.push(this_island_ixs);

		wj_remove_elements(nodes_tocheck_ixs, this_island_ixs);
	}
};

Wj_Jie_Graph.prototype.get_island = function(start_node_ix) {

	var island_nodes = new Array();
	var nodes_to_add = new Array();

	nodes_to_add.push(start_node_ix);

	while (nodes_to_add.length > 0) {

		this_node_ix = nodes_to_add.pop();
		island_nodes.push(this_node_ix);
		nodes_linked_ixs = this.get_links(this_node_ix);

		for (ix_node_linked_ix in nodes_linked_ixs) {
			ix_node_linked = nodes_linked_ixs[ix_node_linked_ix];
			if ((island_nodes.indexOf(ix_node_linked) == -1)
					&& (nodes_to_add.indexOf(ix_node_linked) == -1)) {
				nodes_to_add.push(ix_node_linked);
			}
		}
	}

	return island_nodes;
};

Wj_Jie_Graph.prototype.update_distances = function() {
	// compute the distance matrices storing
	// the relative distance components and modulus
	// for all node combinations to prevent their
	// computation at multiple places
	
	var n_nodes = this.get_n_nodes();
	
	this.rel_dists_x = new Matrix(n_nodes,n_nodes,0);
	this.rel_dists_y = new Matrix(n_nodes,n_nodes,0);
	this.rel_dists_mod = new Matrix(n_nodes,n_nodes,0);
	
	for(var ix_1 = 0; ix_1 < n_nodes; ix_1++) {
		for(var ix_2 = ix_1+1; ix_2 < n_nodes; ix_2++) {
			
			rel_dist = this.get_rel_dist(ix_1,ix_2);
			rel_dist_mod = this.get_modulus(rel_dist);
			
			this.rel_dists_x.set_value_asym(ix_1,ix_2,rel_dist[0]);
			this.rel_dists_y.set_value_asym(ix_1,ix_2,rel_dist[1]);
			this.rel_dists_mod.set_value_sym(ix_1,ix_2,rel_dist_mod);
			
		}
	}
}

Wj_Jie_Graph.prototype.combine_all_forces = function() {
	var n_nodes = this.get_n_nodes();
	
	this.total_forces_x = this.zeros(n_nodes);
	this.total_forces_y = this.zeros(n_nodes);
	
	for(var ix_1 = 0; ix_1 < n_nodes; ix_1++) {
		
		var total_force_x = 0;
		var total_force_y = 0;
		
		for(var ix_2 = 0; ix_2 < n_nodes; ix_2++) {
				
			total_force_x += this.rep_forces_x.get_value(ix_1,ix_2) +
							 this.att_forces_x.get_value(ix_1,ix_2) +
							 this.tor_forces_x.get_value(ix_1,ix_2);
			
			total_force_y += this.rep_forces_y.get_value(ix_1,ix_2) +
							 this.att_forces_y.get_value(ix_1,ix_2) +
							 this.tor_forces_y.get_value(ix_1,ix_2);
			
		}
		
		this.total_forces_x[ix_1] = total_force_x;
		this.total_forces_y[ix_1] = total_force_y;
	}	
};

Wj_Jie_Graph.prototype.move = function() {
	var n_nodes = this.get_n_nodes();
	
	for(var ix_1 = 0; ix_1 < n_nodes; ix_1++) {
		if(this.nodes[ix_1].graph.move_f == 1) {
			this.nodes[ix_1].graph.pos[0] += this.total_forces_x[ix_1]/this.node_mass;
			this.nodes[ix_1].graph.pos[1] += this.total_forces_y[ix_1]/this.node_mass;
		} 
	}			
};

Wj_Jie_Graph.prototype.update_all_rep_forces = function() {
	// loop over all nodes possible combinations and
	// if linked, computes the repulsive force and
	// adds the result to the repulsive forces matrix
	
	var n_nodes = this.get_n_nodes();
	
	for(var ix_1 = 0; ix_1 < n_nodes; ix_1++) {
		for(var ix_2 = ix_1+1; ix_2 < n_nodes; ix_2++) {
			
			this_force = this.get_rep_force(ix_1,ix_2);
			
			this.rep_forces_x.sum_value_asym(ix_1,ix_2,this_force[0]); 
			this.rep_forces_y.sum_value_asym(ix_1,ix_2,this_force[1]);
			
		}
	}
};

Wj_Jie_Graph.prototype.get_rep_force = function(ix_1,ix_2) {
	// computes the repulsive force between two nodes
	
	var rel_dist_x = this.rel_dists_x.get_value(ix_1,ix_2);
	var rel_dist_y = this.rel_dists_y.get_value(ix_1,ix_2);
	var rel_dist_mod = this.rel_dists_mod.get_value(ix_1,ix_2);
	
	if(rel_dist_mod < this.epsilon_dist) {
		rel_dist_x = 1;
		rel_dist_y = 1;
		rel_dist_mod = 1;
	}
	
	var rep_f_mod = this.get_rep_force_mod(rel_dist_mod);
	
	var rep_force = new Array(2);
	rep_force[0] = rel_dist_x/rel_dist_mod*rep_f_mod;
	rep_force[1] = rel_dist_y/rel_dist_mod*rep_f_mod;
	
	return rep_force;
};

Wj_Jie_Graph.prototype.get_modulus = function(vec) {
	return Math.sqrt(vec[0]*vec[0] + vec[1]*vec[1]);
}

Wj_Jie_Graph.prototype.normalize = function(vec) {
	var mod = this.get_modulus(vec);
	var outvec;
	
	if(mod < 0.1) {
		if(Math.abs(vec[0]) > 0) {
			mod = vec[0];
			outvec = [vec[0]/mod , vec[1]/mod];
		} else {
			if(Math.abs(vec[1]) > 0) {
				outvec = vec[1];
				outvec = [vec[0]/mod , vec[1]/mod];
			} else {
				outvec = [1 , 0];
			}
		}
	} else {
		mod = this.get_modulus(vec);
		outvec = [vec[0]/mod , vec[1]/mod];
	}
	
	return outvec;
}

Wj_Jie_Graph.prototype.get_rel_dist = function(ix_1,ix_2) {
	
	var rel_dist = new Array(2);
	rel_dist[0] = this.nodes[ix_1].graph.pos[0] - this.nodes[ix_2].graph.pos[0];
	rel_dist[1] = this.nodes[ix_1].graph.pos[1] - this.nodes[ix_2].graph.pos[1];
	
	return rel_dist;
};

Wj_Jie_Graph.prototype.update_all_att_forces = function() {
	
	// loop over all nodes possible combinations and
	// if linked, computes the attraction force and
	// adds the result to the attraction forces matrix  
	
	var n_nodes = this.get_n_nodes();
	
	for(var ix_1 = 0; ix_1 < n_nodes; ix_1++) {
		for(var ix_2 = ix_1+1; ix_2 < n_nodes; ix_2++) {
			if(this.links_jies.get_value(ix_1,ix_2) == 1) {
				
				this_force = this.get_att_force(ix_1,ix_2);
				
				this.att_forces_x.sum_value_asym(ix_1,ix_2,this_force[0]); 
				this.att_forces_y.sum_value_asym(ix_1,ix_2,this_force[1]);	
			}
		}
	}	
}

Wj_Jie_Graph.prototype.get_att_force = function(ix_1,ix_2) {
	// computes the attractive force between two nodes
	
	var rel_dist_x = this.rel_dists_x.get_value(ix_1,ix_2);
	var rel_dist_y = this.rel_dists_y.get_value(ix_1,ix_2);
	var rel_dist_mod = this.rel_dists_mod.get_value(ix_1,ix_2);
	
	if(rel_dist_mod < this.epsilon_dist) {
		rel_dist_x = 1;
		rel_dist_y = 1;
		rel_dist_mod = 1;
	}
	
	var att_f_mod = this.get_att_force_mod(rel_dist_mod);
	
	var att_force = new Array(2);
	att_force[0] = -rel_dist_x/rel_dist_mod*att_f_mod;
	att_force[1] = -rel_dist_y/rel_dist_mod*att_f_mod;
	
	return att_force;
};

Wj_Jie_Graph.prototype.get_att_force_mod = function(rel_dist_mod) {
	var d_scale = 1;
	var c1      = 1;
	
	var d = rel_dist_mod/this.dist_scale;
	
	var f = c1*d/d_scale;
	/* f = wj_interpolate(this.force_LUT_x,this.att_force_LUT,d,0); */
	
	return f;
};

Wj_Jie_Graph.prototype.get_rep_force_mod = function(rel_dist_mod) {
	var d_scale = 1;
	var c3      = 20;
	var d_min   = 2;
	var d_max   = 3;
	
	var d = rel_dist_mod/this.dist_scale;
	
	if(d > d_min) {
		if(d < d_max) { 
			var f = c3/Math.pow((d/d_scale),2);
		} else {
			var f = 0;
		}
	} else {
		var f = c3/Math.pow((d_min/d_scale),2);
	}
	
	/* f = wj_interpolate(this.force_LUT_x,this.rep_force_LUT,d,0); */
	
	return f;
};

Wj_Jie_Graph.prototype.update_all_tor_forces = function() {
	// loop over all nodes possible combinations and
	// if linked, computes the torsional force and
	// adds the result to the torsional forces matrix
	
	var n_nodes = this.get_n_nodes();
	
	// loop on all the nodes
	for(var ix_c = 0; ix_c < n_nodes; ix_c++) {
		// if a node is linked to at least two other nodes, 
		// it exerts a torsional force on them
		
		var linked_nodes = this.get_links(ix_c);

		if(linked_nodes.length > 1) {
			
			// loop on all the linked nodes
			for(var ix_L1 = 0; ix_L1 < linked_nodes.length; ix_L1++) {
				for(var ix_L2 = ix_L1+1; ix_L2 < linked_nodes.length; ix_L2++) {
					
					this_forces = this.get_tor_forces(ix_c,linked_nodes[ix_L1],linked_nodes[ix_L2]);
					
					// torsional force applied to node ix_1 
					this.tor_forces_x.sum_value(linked_nodes[ix_L1],linked_nodes[ix_L2],this_forces[0][0]);
					this.tor_forces_y.sum_value(linked_nodes[ix_L1],linked_nodes[ix_L2],this_forces[0][1]);

					// torsional force applied to node ix_2
					this.tor_forces_x.sum_value(linked_nodes[ix_L2],linked_nodes[ix_L1],this_forces[1][0]);
					this.tor_forces_y.sum_value(linked_nodes[ix_L2],linked_nodes[ix_L1],this_forces[1][1]);
				}
			}
		}
	}
};

Wj_Jie_Graph.prototype.get_tor_forces = function(ix_c,ix_L1,ix_L2) {
	// computes the torsional force between two nodes
	
	var k_t 	= 1.5;
	
	var C_L1 = [ this.rel_dists_x.get_value(ix_L1,ix_c) , this.rel_dists_y.get_value(ix_L1,ix_c)];
	var C_L2 = [ this.rel_dists_x.get_value(ix_L2,ix_c) , this.rel_dists_y.get_value(ix_L2,ix_c)];
		
	var u_C_L1 = this.normalize(C_L1);
	var u_C_L2 = this.normalize(C_L2);
	
	// angle between the two vectors C to L1 and C to L2
	var cos_theta = u_C_L1[0]*u_C_L2[0] + u_C_L1[1]*u_C_L2[1];
	
	// protection agains numerical errors of dot product
	if(Math.abs(cos_theta) > 1) {
		cos_theta = Math.sign(cos_theta);
	}
	
	var theta = Math.acos(cos_theta);
	
	// torque amplitude is proportional to angle deviation wrt 180 deg (straight) 
	var delta_theta = Math.PI - theta;
	var tor_force_mod = k_t*delta_theta;
	
	/* force direction is applied using cross product wrt to -C_L1
	 f_tor_dir_L1 = (u_CL_1) x (-u_CL_2) x (u_CL_1)
	 
	 cp = (x2*y1-x1*y2);
	 
	 F_tor_dir_L1_x = -y1*(x2*y1-x1*y2) = -y1*cp 
	 F_tor_dir_L1_y = x1*(x2*y1-x1*y2) = x1*cp
	 
	 F_tor_dir_L2 = (u_CL_2) x (-u_CL_1) x (u_CL_2)
	 F_tor_dir_L2_x = -y2*(x1*y2-x2*y1) = -y1*-cp
	 F_tor_dir_L2_y = x2*(x1*y2-x2*y1) = x2*-cp
	 
	*/
	
	var crossp = u_C_L2[0]*u_C_L1[1]-u_C_L1[0]*u_C_L2[1];
	
	var tor_dir_L1;
	var tor_dir_L2;
	
	if(Math.abs(crossp) > 0.01) {
		tor_dir_L1 = this.normalize([-u_C_L1[1]*crossp , u_C_L1[0]*crossp]);
		tor_dir_L2 = this.normalize([ u_C_L2[1]*crossp ,-u_C_L2[0]*crossp]);
	} else {
		tor_dir_L1 = [-u_C_L1[1] , u_C_L1[0]];
		tor_dir_L2 = [ u_C_L2[1] ,-u_C_L2[0]];
	}
		
	var tor_force_L1 = [ tor_dir_L1[0]*tor_force_mod,  tor_dir_L1[1]*tor_force_mod ];
	var tor_force_L2 = [ tor_dir_L2[0]*tor_force_mod,  tor_dir_L2[1]*tor_force_mod ];
	
	var tor_forces = [tor_force_L1,tor_force_L2];
	
	return tor_forces;
};

Wj_Jie_Graph.prototype.zeros = function(n) {
	var a = new Array(n);
	
	for(var ix = 0; ix < n; ix++) {
		a[ix] = 0.0;
	}
	
	return a;
};
























