var async = require('async');
var express = require('express');
var router = express.Router();
var mysql = require('mysql');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "toor",
  database: "nagios"
});

var credentials = {connectionLimit : 10,
  host            : 'localhost',
  user            : 'root',
  password        : 'toor',
  database        : 'nagios'}



/*----------------------list admins-------------*/

router.get('/users', function(req, res, next){
        con.query("SELECT a.id_group, a.id_admin, a.admin_name, a.admin_password FROM nagios_admins a", function (err, result, fields){
                if (err) throw err;
                res.send(result);
                });
});


/*----------------groups function ------------------------------*/

var groups = function(callback){
	con.query("SELECT * from nagios_admin_groups", function(err, result, fields){
		if (err) throw err;
		callback(result);
		});
}

	
var groupsmembers = function(callback){
	con.query("select g.group_name, GROUP_CONCAT(JSON_OBJECT('admin_id',a.id_admin,'name', admin_name))AS listofadmins from nagios_admin_groups g, nagios_admins a where a.id_group=g.id_group group by g.group_name", function(err, result, fields){
		if (err) throw err;
		for (var i in result)
			result[i].listofadmins=JSON.parse("[" + result[i].listofadmins + "]");
		
		callback(result);
	});
}

router.get('/groups', function(req, res, next){
        groupsmembers(function(data2){
		groups(function(data){
			for (var i=0;i<data.length;i++){
				k=0;
				for (var j=0;j<data2.length;j++){
					if (data[i].group_name==data2[j].group_name) {
						data[i]["listofadmins"]=data2[j].listofadmins ; 
						break; 
					}else k=k+1;
				if (k==data2.length) data[i]["listofadmins"]='';
				}
			}
					
	res.send(data);
                });});
});

/*-----------------end groups ----------------------------*/

/* ------------all hosts for root----------------*/
var roothosts = function(callback){
        con.query("SELECT hosts.display_name, hosts.address, hoststat.output, hoststat.status_update_time FROM nagios_hoststatus hoststat, nagios_hosts hosts WHERE hoststat.host_object_id=hosts.host_object_id", function(err, result, fields){
                if (err) throw err;
                callback(result);
                });
}

router.get('/roothosts', function(req, res, next){
        roothosts(function(data){
        res.send(data);
        });
});

var rootservices = function(callback){
	con.query("SELECT hosts.display_name, GROUP_CONCAT(JSON_OBJECT('updateTime',status.status_update_time,'service',services.display_name,'output',status.output))AS listofservices FROM nagios_servicestatus status, nagios_hosts hosts, nagios_services services WHERE hosts.host_object_id=services.host_object_id AND status.service_object_id=services.service_object_id GROUP BY hosts.display_name ", function (err, result, fields){
                        if (err) throw err;
			for (var i in result){
                        result[i].listofservices=JSON.parse("[" + result[i].listofservices + "]");
                }			
                	callback(result);
                });
}

router.get('/rootservices', function(req, res, next){
        
roothosts(function(data){
                rootservices(function(data2){
                for (var i in data){
                        for (var j in data2){
                               if (data[i].display_name==data2[j].display_name)
                                        data[i].services=data2[j].listofservices;
                }}
                res.send(data);
         });});
});
/*end of root services */

/*-----------------all groups privieleges----------------*/

var priv = function ( callback){
	con.query("select groups.group_name, GROUP_CONCAT(JSON_OBJECT('host', hosts.display_name, 'serviceid',services.service_object_id,'servicename',services.display_name))AS list from nagios_hosts hosts, nagios_group_priv priv, nagios_admin_groups groups, nagios_services services  WHERE priv.id_group=groups.id_group  AND priv.service_id=services.service_object_id AND hosts.host_object_id =services.host_object_id GROUP BY groups.group_name", function(err, result, fields){
                if (err) throw err;
		for (var i in result){
                        result[i].list=JSON.parse("[" + result[i].list + "]");
                }
                callback(result);
        });
}
router.get('/priv', function(req, res, next){
        priv(function(data){
        res.send(data);
        });
});



/*-------------------hosts by id ---------------------------*/

router.get('/hosts/:id', function(req, res, next){
con.query("SELECT DISTINCT hosts.host_object_id, hosts.display_name, hosts.address, status.status_update_time, status.output FROM nagios_admins admins, nagios_hosts hosts, nagios_group_priv priv, nagios_hoststatus status, nagios_services services where priv.id_group=admins.id_group and hosts.host_object_id=services.host_object_id and services.service_object_id=priv.service_id and status.host_object_id=hosts.host_object_id and admins.id_admin=? ",[req.params.id],function(err, result, fields){
                if (err) throw err;
                             
       		res.send(result); 
	});
});


/*---------------------services by id -----------------------*/


router.get('/services/:id', function (req, res) {
	
    var id=req.params.id;
    var pool = mysql.createPool(credentials);
    var query1 = "SELECT DISTINCT hosts.host_object_id, hosts.display_name, hosts.address, status.status_update_time, status.output FROM nagios_admins admins, nagios_hosts hosts, nagios_group_priv priv, nagios_hoststatus status, nagios_services services where priv.id_group=admins.id_group and hosts.host_object_id=services.host_object_id and services.service_object_id=priv.service_id and status.host_object_id=hosts.host_object_id and admins.id_admin=?" ;

    var query2 = "SELECT  hosts.display_name, GROUP_CONCAT(JSON_OBJECT('Service_id', services.service_object_id,'updateTime',status.status_update_time,'service',services.display_name,'output',status.output))AS list FROM nagios_admins admins, nagios_servicestatus status, nagios_hosts hosts, nagios_services services, nagios_group_priv priv WHERE priv.id_group=admins.id_group AND services.service_object_id=priv.service_id AND hosts.host_object_id=services.host_object_id AND status.service_object_id=services.service_object_id AND admins.id_admin=? GROUP BY hosts.display_name";

    var return_data = {};

    async.parallel([
       function(parallel_done) {
           pool.query(query1, [id], function(err, results) {
               if (err) return parallel_done(err);
               return_data.table1 = results;
               parallel_done();
           });
       },
       function(parallel_done) {
           pool.query(query2, [id], function(err, results) {
               if (err) return parallel_done(err);
			
			for (var i in results){
			results[i].list=JSON.parse("[" + results[i].list + "]");
		}               
		
		return_data.table2 = results;

               parallel_done();
           });
       }
    ], function(err) {
         if (err) console.log(err);
         pool.end();

			for (var i in return_data.table1){
        	        for (var j in return_data.table2){
        	                if (return_data.table1[i].display_name==return_data.table2[j].display_name)
        	                        return_data.table1[i].services=return_data.table2[j].list;
        	
       	 	}}

         res.send(return_data.table1);
    });
});

/*-----------------adding missing privieleges-----------------------*/
router.get('/addprivi/:group_id', function(req, res, next){
	con.query("SELECT hosts.display_name, GROUP_CONCAT(JSON_OBJECT ('servicename', services.display_name, 'serviceid', services.service_object_id )) AS list from nagios_services services, nagios_hosts hosts where services.service_object_id NOT IN (SELECT services.service_object_id from nagios_hosts hosts, nagios_services services, nagios_group_priv priv WHERE priv.id_group=? AND priv.service_id=services.service_object_id AND services.host_object_id=hosts.host_object_id AND hosts.host_object_id=services.host_object_id) AND hosts.host_object_id=services.host_object_id GROUP BY hosts.display_name", [req.params.group_id], function(err, result, fields){
                if (err) throw err;
                for (var i in result){
                        result[i].list=JSON.parse("[" + result[i].list + "]");
                }        
                
        res.send(result);
        });
});


/*---------------------getting privielegs for group by id-----------*/
router.get('/priv/:group_id', function(req, res, next){
        con.query("SELECT hosts.display_name, GROUP_CONCAT(JSON_OBJECT ('servicename', services.display_name, 'service id', services.service_object_id )) AS list from nagios_services services, nagios_hosts hosts where services.service_object_id IN (SELECT services.service_object_id from nagios_hosts hosts, nagios_services services, nagios_group_priv priv WHERE priv.id_group=? AND priv.service_id=services.service_object_id AND services.host_object_id=hosts.host_object_id AND hosts.host_object_id=services.host_object_id) AND hosts.host_object_id=services.host_object_id GROUP BY hosts.display_name", [req.params.group_id], function(err, result, fields){
                if (err) throw err;
                for (var i in result){
                        result[i].list=JSON.parse("[" + result[i].list + "]");
                }        
                
        res.send(result);
        });
});


module.exports = router;
