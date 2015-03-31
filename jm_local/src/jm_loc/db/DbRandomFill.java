package jm_loc.db;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.nio.file.*;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

public class DbRandomFill extends DbHandle {

	public DbRandomFill() throws SQLException {
		super();
		// TODO Auto-generated constructor stub
	}

	public void random_init() throws SQLException, IOException {
		URI url_file = new File("../large_data/top-1m.csv").toURI();	
		URI tag_file = new File("../large_data/adjectives.txt").toURI();
		
		int n_urls = 100;
		int n_tags = 20;
		int n_nodes = 50;
		int n_jies = 100;
				
		this.drop_and_create_all_tables();
		
		this.create_urls_from_file(n_urls,url_file);
		this.create_tags_from_file(n_tags,tag_file);
		
		this.create_random_nodes(n_nodes);
		this.create_random_jies(n_jies);
		this.assign_random_tags_to_jies();

	}
	
	private void create_urls_from_file(int n, URI filename) throws IOException, SQLException {
		
		List<URL> url_list = get_random_url_list(n,filename);	
		
		for(URL url : url_list) {
			this.add_url(url);
		}
	}
	
	private void create_tags_from_file(int n, URI filename) throws IOException, SQLException {
		
		List<String> tag_list = get_random_tag_list(n,filename);	
		
		for(String tag : tag_list) {
			this.add_tag(tag);
		}
	}
	
	private static List<URL> get_random_url_list(int n, URI filename) throws IOException {
		Path filePath = Paths.get(filename);
		Scanner file_scanner = new Scanner(filePath);
		List<URL> url_list = new ArrayList<URL>();
		
		for(int ix = 0; ix < n; ix++) {
			String url_str = parse_csv_line(file_scanner.next());
			URL new_url = new URL("http://www."+url_str);
			url_list.add(new_url);	
		} 
		
		file_scanner.close();
		
		return url_list;
	}
	
	private static List<String> get_random_tag_list(int n, URI filename) throws IOException {
		Path filePath = Paths.get(filename);
		Scanner file_scanner = new Scanner(filePath);
		List<String> tag_list = new ArrayList<String>();
		
		for(int ix = 0; ix < n; ix++) {
			String tag_str = file_scanner.next();
			tag_list.add(tag_str);	
		} 
		
		file_scanner.close();
		
		return tag_list;
	}
	
	private static String parse_csv_line(String line) {
        Scanner line_scanner = new Scanner(line);
        line_scanner.useDelimiter(",");
        
        line_scanner.nextInt();
        String url_str = line_scanner.next();
        
        line_scanner.close();
        
        return url_str; 
   }

	private void create_random_nodes(int n_nodes) throws SQLException {
		int n_urls_min = 1;
		int n_urls_max = 6;
				
		String node_title;
		String node_desc;
		int n_urls;
		
		List<Integer> all_url_ids = this.get_all_ele_ids("urls");
		
		for(int ix_node = 1; ix_node <= n_nodes; ix_node++) {
			
			node_title = "Node " + Integer.toString(ix_node);
			node_desc = "Description of Node " + Integer.toString(ix_node);
			
			int node_id = this.add_node(node_title,node_desc);
			
			List<Integer> url_ixs_to_add = new ArrayList<Integer>();
			n_urls = random_engine.nextInt(n_urls_max - n_urls_min + 1) + n_urls_min;

			for(int ix_url = 1; ix_url <= n_urls; ix_url++) {
				Integer url_id_ix = this.random_engine.nextInt(all_url_ids.size());
				while(url_ixs_to_add.contains(url_id_ix)) {
					url_id_ix = this.random_engine.nextInt(all_url_ids.size());	
				};
				url_ixs_to_add.add(url_id_ix);
			}
			
			for(Integer url_ix : url_ixs_to_add) { 
				int url_id = all_url_ids.get(url_ix);
				this.add_url_to_node(node_id,url_id);
			}
		}
	}
	
	private void create_random_jies(int n_jies) throws SQLException {
		int n_nodes_min = 1;
		int n_nodes_max = 6;
				
		String jie_title;
		String jie_desc;
		
		int n_nodes;
		
		List<Integer> all_node_ids = this.get_all_ele_ids("nodes");
		
		for(int ix_jie = 1; ix_jie <= n_jies; ix_jie++) {
			
			jie_title = "Jie " + Integer.toString(ix_jie);
			jie_desc = "Description of Jie " + Integer.toString(ix_jie);
			
			int jie_id = this.add_jie(jie_title,jie_desc);
			
			List<Integer> nodes_ixs_to_add = new ArrayList<Integer>();
			n_nodes = random_engine.nextInt(n_nodes_max - n_nodes_min + 1) + n_nodes_min;
			
			for(int ix_node = 1; ix_node <= n_nodes; ix_node++) { 
				Integer node_id_ix = this.random_engine.nextInt(all_node_ids.size());
				while(nodes_ixs_to_add.contains(node_id_ix)) {
					// prevent duplicated nodes in a jie
					node_id_ix = this.random_engine.nextInt(all_node_ids.size());	
				};
				nodes_ixs_to_add.add(node_id_ix);
			}
			
			for(Integer node_id_ix : nodes_ixs_to_add) { 
				int node_id = all_node_ids.get(node_id_ix);
				this.add_node_to_jie(jie_id,node_id);
			}
		}
	}
	
	private void assign_random_tags_to_jies() throws SQLException {
		int n_tags_min = 3;
		int n_tags_max = 5;
				
		List<Integer> all_jie_ids = this.get_all_ele_ids("jies");
		List<Integer> all_tags_ids = this.get_all_ele_ids("tags");
		
		for(int jie_id : all_jie_ids) {
			
			int n_tags_to_add = random_engine.nextInt(n_tags_max - n_tags_min + 1) + n_tags_min;
			
			for(int ix_tag = 1; ix_tag <= n_tags_to_add; ix_tag++) { 
				
				int tag_id_ix = this.random_engine.nextInt(all_tags_ids.size());
				int tag_id = all_tags_ids.get(tag_id_ix);
				this.add_tag_to_jie(jie_id,tag_id);
				
			}
		}
	}
	
	private List<Integer> get_all_ele_ids(String table_name) throws SQLException {
		PreparedStatement st = null;
		ResultSet rs = null;
		String st_str;
		List<Integer> all_url_ids = new ArrayList<Integer>();
		
		st_str = "SELECT id FROM " + table_name;
		st = this.con.prepareStatement(st_str);
		rs = st.executeQuery();
		
		while(rs.next()) {
			all_url_ids.add(rs.getInt("id"));
		}
		
		return all_url_ids;
	}
	
}