/**
 * Código simples - KIS
 * 
 * Conceitos iniciais: 
 *  - CouchDB 2.0 (3.0 não cheguei a ver)
 *  - Baseado em HTTP (admin party - localhost)
 *  - Replicação Multimestre
 *  - Histórico de todas alterações
 *  - Acessando Fauxton http://localhost:5984/_utils/
 * 
 *  - PouchDB
 * 
 *  - MapReduce (não é o mesmo do vanilla)
 *  - Pouchdb-find > Mongodb
 * 
 *  - Tudo é um documento
 *  - Não há collections
 */

const PouchDB = require('pouchdb');
const PouchDBFind = require('pouchdb-find');
const bcrypt = require('bcrypt');
const fs = require('fs');


/**
 * Função para criptografia e verficação de senha
 * 
 * - Return await não é necessário
 * - Importancia da senha não reversível
 */

encrypt = async (password) => bcrypt.hash(password, 10);

verify = async (password, hashed) => bcrypt.compare(password, hashed);


// iife - Immediately invoked function expression
(async () => {
    try {

        /**
         * Instanciando um novo objeto de conexão
         * 
         */
        PouchDB.plugin(PouchDBFind);
        const db = new PouchDB('http://localhost:5984/couchdb-talk-1');

        /**
         * Limpando banco de dados
         */

        await Promise.all((await db.allDocs()).rows.map(row => db.remove(row.id, row.value.rev)));        


        /**
         * Criando um novo usuário no sistema
         * 
         * Referencia de API: https://pouchdb.com/api.html
         */

        const usuarioFernando = {
            type: 'user',
            nome: 'Fernando',
            senha: await encrypt('12345678')
        }

        const { id: usuarioFernandoId, rev: usuarioFernandoRev } = (await db.post(usuarioFernando));


        /**
         * Atualizando o usuário SE é sabido o rev do mesmo
         * 
         * POST vs PUT
         */

        const usuarioFernandoAtualizado = {
            _id: usuarioFernandoId,
            _rev: usuarioFernandoRev,
            type: 'user',
            nome: 'Fernando Reis Guimarães',
            senha: usuarioFernando.senha // É necessário enviar todos os dados novamente
        }

        const { rev: usuarioFernandoAtualizadoRev } = (await db.put(usuarioFernandoAtualizado));


        /**
         * Atualizando somente com o ID
         */

        // Primeiro recuperamos o objeto
        const usuarioFernandoAtualizadoArmazenado = await db.get(usuarioFernandoId);


        // Atualizamos seus propriedades
        const usuarioFernandoReatualizado = {
            ...usuarioFernandoAtualizadoArmazenado,
            nome: 'Fernando G Reis'
        }

        // Devolvemos para o banco
        const { rev: usuarioFernandoReatualizadoRev }  = (await db.put(usuarioFernandoReatualizado));

        
        /**
         * Executando consultas via MapReduce (não é o mesmo do vanilla)
         */

        // Populando banco com mais alguns usuários
        const docrevAntonio = await db.post({ type: 'user', nome: 'Antonio'});
        const docrevSandra = await db.post({ type: 'user', nome: 'Sandra'});
        const docrevGlaucio = await db.post({ type: 'dev', nome: 'Glaucio'});
        const docrevGustavo = await db.post({ type: 'dev', nome: 'Gustavo'});
        const docrevDiego = await db.post({ type: 'leader', nome: 'Diego'});
        const docrevFabio = await db.post({ type: 'friend', nome: 'Fabio'});

        // Imprimindo todos os usuários existente no banco de dados
        console.log('');
        console.log('Todos documentos');
        console.log('------------------------------------');
        console.log(JSON.stringify((await db.allDocs({include_docs: true})).rows.map(row => row.doc), null, 2))

        // Criando o documento de design (view)
        const nomeViewDesignDocument = await db.put({
            _id: '_design/nome',
            views: {
                nome: {
                    map: function(doc) {
                        if (doc.nome) 
                            emit(doc.nome, doc._id);
                    }.toString()
                }
            }
        });


        // Consultando todos os usuários que começam com a letra F
        const usuariosComecamF_MapReduce = await db.query('nome', {
            startkey: 'F',
            endkey: 'G',
            include_docs: true
        });

        console.log('');
        console.log('Usuarios que comecam com F MapReduce');
        console.log('------------------------------------');
        console.log(JSON.stringify(usuariosComecamF_MapReduce, null, 2));
        

        // Consultando todos os usuários que começam com a letra Fe
        const usuariosComecamFe_MapReduce = await db.query('nome', {
            startkey: 'Fe',
            endkey: 'G',
            include_docs: true
        })


        console.log('');
        console.log('Usuarios que comecam com Fe MapReduce');
        console.log('------------------------------------');
        console.log(JSON.stringify(usuariosComecamFe_MapReduce, null, 2));


        /**
         * Criando um indice Mango
         */
        
        await db.createIndex({
            index: {
                fields: ['type', 'nome']
            }
        });


        // Consultando todos os usuários que começam com a letra F
        const usuariosComecamF_Mango = await db.find({
            selector: {
                type: 'user',
                nome: { 
                    $gt: 'F',
                    $lt: 'G' 
                }
            }
        });


        console.log('');
        console.log('Usuarios que comecam com F Mango');
        console.log('------------------------------------');
        console.log(JSON.stringify(usuariosComecamF_Mango, null, 2));


        // Consultando todos os usuários que começam com a letra Fe
        const usuariosComecamFe_Mango = await db.find({
            selector: {
                type: 'user',
                nome: { 
                    $gt: 'Fe',
                    $lt: 'G' 
                }
            }
        });


        console.log('');
        console.log('Usuarios que comecam com Fe Mango');
        console.log('------------------------------------');
        console.log(JSON.stringify(usuariosComecamFe_Mango, null, 2));

        /**
         * Removendo um usuário quando se tem o Id e Rev
         */

        await db.remove(usuarioFernandoId, usuarioFernandoReatualizadoRev);


        /**
         * Removendo um usuário quando só se tem o Id
         */       

        await db.remove(await db.get(docrevFabio.id));


        /**
         * Talk 2 - Consultas complexas
         * 
         *  - Várias condições de consulta OR e AND
         * 
         *  - Agregação 
         *      select month(data), valor 
         *      from pagamentos 
         *      group by 
         *          month(data) 
         *      order by 
         *          1 desc
         */
        

        /**
         * Talk 3 - Aplicações Offline first
         * - Arquitetura 
         *      1 usuário por banco de dados (front-end <-> couchdb)
         *      Banco de dados público (front-end <-> couchdb)
         *      Informações sensiveis (front-end <-> back-end <-> couchdb)
         *      Embutido
         */
         

    } catch(err) {
        console.error(err, err.stack)
    }
})()
