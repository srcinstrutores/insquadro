        const SUPABASE_URL = 'https://nzgpnnaukglgkaleiwou.supabase.co'
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56Z3BubmF1a2dsZ2thbGVpd291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzczNDQsImV4cCI6MjA4Njg1MzM0NH0.TV1bGQThBDK-3DtKtmR28gaZlbilbNEFQgPPak6701c'
        const PLANILHA_URL = 'https://script.google.com/macros/s/AKfycbzhJdbeZfxkHgh3cQrK_YlhBCuhZyLhM_9jYkAnCPmbz-aYpv7845740KySuhjTzdIb/exec'

        const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

        let usuarioAtual = {
            nick: '',
            cargo: '',
            cargoSistema: '',
            setorFiscalizacao: false,
            nivelAcesso: 4,
            permissoes: {}
        }

        let itemParaExcluir = null
        let tipoParaExcluir = null

        let dados = {
            observacoes: [],
            advertencias: []
        }

        let logsSistema = []

        const hierarquiaCargos = {
            'Presidente': 4,
            'Vice-Presidente': 4,
            'Diretor': 4,
            'Fiscalizador': 4,
            'presidente': 4,
            'vice-presidente': 4,
            'diretor': 4,
            'fiscalizador': 4,
            'Líder': 3,
            'Vice-Líder': 3,
            'Vice-Lider': 3,
            'lider': 3,
            'vice-lider': 3,
            'vice-líder': 3,
            'líder': 3,
            'Ministro': 2,
            'Estagiário': 2,
            'ministro': 2,
            'estagiário': 2,
            'estagiario': 2,
            'Instrutor': 1,
            'Monitor': 1,
            'Avaliador': 1,
            'Capacitador': 1,
            'instrutor': 1,
            'monitor': 1,
            'avaliador': 1,
            'capacitador': 1
        }

        function isSetorFiscalizacao(cargo) {
            const cargosFiscalizacao = ['Presidente', 'Vice-Presidente', 'Diretor', 'Fiscalizador',
                'presidente', 'vice-presidente', 'diretor', 'fiscalizador']
            return cargosFiscalizacao.includes(cargo)
        }

        function isMinisterio(cargo) {
            const cargosMinisterio = ['Ministro', 'Estagiário', 'ministro', 'estagiário', 'estagiario']
            return cargosMinisterio.includes(cargo)
        }

        async function pegarUsernameForum() {
            try {
                const resposta = await fetch("/forum")
                const html = await resposta.text()
                const regex = /_userdata\["username"\]\s*=\s*"([^"]+)"/
                const match = html.match(regex)

                if (match && match[1]) {
                    const username = match[1]
                    localStorage.setItem("forumUser", username)
                    return username
                }
                throw new Error('Não autenticado no fórum')
            } catch (err) {
                console.error("Erro ao buscar username:", err)
                const fallback = localStorage.getItem("forumUser")
                if (fallback) return fallback
                showToast('Erro', 'Você precisa estar logado no fórum RCC', 'error')
                throw err
            }
        }

        async function buscarCargoPlanilha(nick) {
            try {
                const response = await fetch(PLANILHA_URL)
                const dados = await response.json()

                console.log('========== DEBUG ==========')
                console.log('Total de registros:', dados.length)
                console.log('Procurando por:', nick)

                const ocorrenciasUsuario = dados.filter(p => {
                    const nickPlanilha = (p.nick || '').toString().trim()
                    return nickPlanilha.toLowerCase() === nick.toLowerCase()
                })

                console.log('Ocorrências encontradas:', ocorrenciasUsuario.length)
                console.log('Registros:', ocorrenciasUsuario)

                if (ocorrenciasUsuario.length === 0) {
                    console.error('Usuário não encontrado em nenhuma lista')
                    return {
                        nick: nick,
                        cargo: 'Visitante',
                        cargoOriginal: 'Visitante',
                        setorFiscalizacao: false,
                        nivelPrincipal: 0,
                        nivelFiscalizacao: 0,
                        nivelEfetivo: 0
                    }
                }

                let cargoPrincipal = null
                let cargoFiscalizacao = null
                let temMinisterio = false
                let temFiscalizacao = false
                let nivelMaisAlto = 0

                for (const registro of ocorrenciasUsuario) {
                    const cargo = registro.cargo || ''
                    const cargoOriginal = registro.cargoOriginal || ''
                    const nivel = hierarquiaCargos[cargo] || 0

                    console.log(`Analisando: ${cargo} (nível ${nivel})`)

                    if (isSetorFiscalizacao(cargo)) {
                        temFiscalizacao = true
                        cargoFiscalizacao = cargoOriginal
                        console.log('-> É fiscalização!')
                    }

                    if (isMinisterio(cargo)) {
                        temMinisterio = true
                        console.log('-> É ministério!')
                    }

                    if (!isSetorFiscalizacao(cargo) && nivel > nivelMaisAlto) {
                        nivelMaisAlto = nivel
                        cargoPrincipal = cargoOriginal
                        console.log('-> Novo cargo principal!')
                    }
                }

                if (!cargoPrincipal && ocorrenciasUsuario.length > 0) {
                    const primeiro = ocorrenciasUsuario[0]
                    cargoPrincipal = primeiro.cargoOriginal
                    nivelMaisAlto = hierarquiaCargos[primeiro.cargo] || 0
                }

                const nivelPrincipal = nivelMaisAlto
                const nivelFiscalizacao = temFiscalizacao ? 4 : 0

                let nivelEfetivo
                if (temMinisterio && temFiscalizacao) {
                    nivelEfetivo = 2
                } else if (temFiscalizacao) {
                    nivelEfetivo = 4
                } else {
                    nivelEfetivo = nivelPrincipal
                }

                console.log('========== RESULTADO ==========')
                console.log('Cargo Principal:', cargoPrincipal)
                console.log('Cargo Fiscalização:', cargoFiscalizacao)
                console.log('Tem Ministério:', temMinisterio)
                console.log('Tem Fiscalização:', temFiscalizacao)
                console.log('Nivel Principal:', nivelPrincipal)
                console.log('Nivel Fiscalização:', nivelFiscalizacao)
                console.log('Nivel Efetivo:', nivelEfetivo)
                console.log('===============================')

                return {
                    nick: nick,
                    cargoPrincipal: cargoPrincipal,
                    cargoFiscalizacao: cargoFiscalizacao,
                    temMinisterio: temMinisterio,
                    temFiscalizacao: temFiscalizacao,
                    nivelPrincipal: nivelPrincipal,
                    nivelFiscalizacao: nivelFiscalizacao,
                    cargo: temFiscalizacao ? cargoFiscalizacao : cargoPrincipal,
                    cargoOriginal: temFiscalizacao ? cargoFiscalizacao : cargoPrincipal,
                    setorFiscalizacao: temFiscalizacao,
                    dualCargo: temMinisterio && temFiscalizacao,
                    nivelEfetivo: nivelEfetivo
                }

            } catch (err) {
                console.error("Erro ao buscar cargo:", err)
                return {
                    nick: nick,
                    cargo: 'Visitante',
                    cargoOriginal: 'Visitante',
                    setorFiscalizacao: false,
                    nivelPrincipal: 0,
                    nivelFiscalizacao: 0,
                    nivelEfetivo: 0
                }
            }
        }

        function mapearCargoSistema(cargo) {
            if (!cargo) return 'Visitante'

            const normalizado = cargo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

            const mapa = {
                'presidente': 'Presidente',
                'vice-presidente': 'Vice-Presidente',
                'diretor': 'Diretor',
                'fiscalizador': 'Fiscalizador',
                'lider': 'Líder',
                'vice-lider': 'Vice-Líder',
                'ministro': 'Ministro',
                'estagiario': 'Estagiário',
                'capacitador': 'Capacitador',
                'avaliador': 'Avaliador',
                'monitor': 'Monitor',
                'instrutor': 'Instrutor'
            }

            return mapa[normalizado] || cargo
        }

        function podeDeferirCargo(cargoAutor, cargoAlvo) {
            const nivelAutor = hierarquiaCargos[cargoAutor] || 0
            const nivelAlvo = hierarquiaCargos[cargoAlvo] || 0

            console.log(`Verificando deferimento: ${cargoAutor} (nível ${nivelAutor}) -> ${cargoAlvo} (nível ${nivelAlvo})`)

            if (nivelAutor === 3) return true;
            if (nivelAutor === 2) {
                return nivelAlvo === 4 || nivelAlvo === 1;
            }

            if (nivelAutor === 4) {
                return nivelAlvo === 1;
            }

            if (nivelAutor === 1) {
                return false;
            }

            return false
        }

        async function inicializarSistema() {
            showToast('Carregando', 'Verificando permissões...', 'success')

            try {
                const nick = await pegarUsernameForum()
                console.log('Nick do fórum:', nick)

                const dadosPlanilha = await buscarCargoPlanilha(nick)
                console.log('Dados da planilha processados:', dadosPlanilha)

                if (dadosPlanilha.cargo === 'Visitante') {
                    console.error('Usuário não encontrado na planilha!')
                    showToast('Erro', 'Você não está cadastrado na planilha de membros', 'error')

                    usuarioAtual = {
                        nick: nick,
                        cargo: 'Visitante',
                        cargoSistema: 'Visitante',
                        setorFiscalizacao: false,
                        nivelAcesso: 0,
                        dualCargo: false,
                        permissoes: {
                            pode_criar: false,
                            pode_excluir: false,
                            pode_ver_tudo: false,
                            pode_deferir_cargos: [],
                            envia_mp: false,
                            is_fiscalizacao_pura: false
                        }
                    }
                    verificarPermissoesUI()
                    return
                }

                const nivelEfetivo = dadosPlanilha.nivelEfetivo
                const isFiscalizacaoPura = dadosPlanilha.temFiscalizacao && !dadosPlanilha.temMinisterio
                const isDualCargo = dadosPlanilha.dualCargo

                console.log('nivelEfetivo:', nivelEfetivo)
                console.log('isFiscalizacaoPura:', isFiscalizacaoPura)
                console.log('isDualCargo:', isDualCargo)

                const podeCriar = nivelEfetivo >= 2 || isFiscalizacaoPura
                const podeExcluir = nivelEfetivo >= 2 && !isFiscalizacaoPura
                const podeVerTudo = nivelEfetivo >= 2 || isFiscalizacaoPura

                let podeDeferir = []
                if (isFiscalizacaoPura) {
                    podeDeferir = ['Instrutor', 'Monitor', 'Avaliador', 'Capacitador',
                        'instrutor', 'monitor', 'avaliador', 'capacitador']
                } else {
                    podeDeferir = Object.entries(hierarquiaCargos)
                        .filter(([cargo, n]) => n < nivelEfetivo && n > 0)
                        .map(([cargo, n]) => cargo)
                        .filter((v, i, a) => a.indexOf(v) === i)
                }

                const cargoExibicao = mapearCargoSistema(dadosPlanilha.cargo)
                const cargoSistema = cargoExibicao

                usuarioAtual = {
                    nick: nick,
                    cargo: cargoExibicao,
                    cargoSistema: cargoSistema,
                    cargoPrincipal: dadosPlanilha.cargoPrincipal,
                    cargoFiscalizacao: dadosPlanilha.cargoFiscalizacao,
                    setorFiscalizacao: dadosPlanilha.temFiscalizacao,
                    dualCargo: isDualCargo,
                    nivelAcesso: nivelEfetivo,
                    nivelPrincipal: dadosPlanilha.nivelPrincipal,
                    nivelFiscalizacao: dadosPlanilha.nivelFiscalizacao,
                    permissoes: {
                        pode_criar: podeCriar,
                        pode_excluir: podeExcluir,
                        pode_ver_tudo: podeVerTudo,
                        pode_deferir_cargos: podeDeferir,
                        envia_mp: !isFiscalizacaoPura,
                        is_fiscalizacao_pura: isFiscalizacaoPura
                    }
                }

                console.log('Usuário configurado final:', usuarioAtual)

                verificarPermissoesUI()
                await carregarAdvertencias()

                if (usuarioAtual.nivelAcesso >= 2 && usuarioAtual.nivelAcesso <= 3 && !isFiscalizacaoPura) {
                    console.log('Carregando logs...')
                    await carregarLogs()
                }

                let cargoDisplay = cargoExibicao
                if (isDualCargo) {
                    cargoDisplay = `${dadosPlanilha.cargoPrincipal} + ${dadosPlanilha.cargoFiscalizacao}`
                } else if (isFiscalizacaoPura) {
                    cargoDisplay = `${cargoExibicao} (Setor de Fiscalização)`
                } else if (dadosPlanilha.temFiscalizacao) {
                    cargoDisplay = `${cargoExibicao} + Setor de Fiscalização`
                }

                showToast('Bem-vindo', `${nick} (${cargoDisplay})`, 'success')

            } catch (err) {
                console.error("Erro na inicialização:", err)
                showToast('Erro', 'Falha ao inicializar: ' + err.message, 'error')
            }
        }

        function verificarPermissoesUI() {
            console.log('=== verificarPermissoesUI ===')
            console.log('usuarioAtual:', usuarioAtual)

            const isFiscalizacaoPura = usuarioAtual.permissoes?.is_fiscalizacao_pura
            const podeCriar = usuarioAtual.permissoes?.pode_criar
            const podeExcluir = usuarioAtual.permissoes?.pode_excluir

            const mostrarPainel = podeCriar

            const adminPanel = document.getElementById('adminPanel')
            const viewerNotice = document.getElementById('viewerNotice')
            const btnLogs = document.getElementById('btnLogs')

            const panelBadgesContainer = document.getElementById('panelBadges')
            if (panelBadgesContainer) {
                let badgesHTML = ''

                if (usuarioAtual.dualCargo) {
                    console.log('Renderizando DUAL cargo')
                    badgesHTML = `
                <span class="panel-badge ministerio">${mapearCargoSistema(usuarioAtual.cargoPrincipal)}</span>
                <span class="panel-badge fiscalizacao">${usuarioAtual.cargoFiscalizacao}</span>
            `
                } else if (isFiscalizacaoPura) {
                    console.log('Renderizando FISCALIZACAO PURA')
                    badgesHTML = `<span class="panel-badge fiscalizacao">${usuarioAtual.cargo} (Setor de Fiscalização)</span>`
                } else if (usuarioAtual.setorFiscalizacao) {
                    console.log('Renderizando cargo com fiscalização')
                    badgesHTML = `
                <span class="panel-badge ministerio">${usuarioAtual.cargo}</span>
                <span class="panel-badge fiscalizacao">Setor de Fiscalização</span>
            `
                } else {
                    console.log('Renderizando cargo normal')
                    const labels = {
                        3: 'Liderança',
                        2: 'Ministério',
                        1: 'Operacional',
                        0: 'Visitante',
                        4: 'Fiscalização'
                    }
                    const badgeClass = usuarioAtual.nivelAcesso === 3 ? 'lideranca' :
                        usuarioAtual.nivelAcesso === 2 ? 'ministerio' :
                            usuarioAtual.nivelAcesso === 4 ? 'fiscalizacao' : ''
                    badgesHTML = `<span class="panel-badge ${badgeClass}">${labels[usuarioAtual.nivelAcesso] || 'Desconhecido'}</span>`
                }

                console.log('HTML gerado:', badgesHTML)
                panelBadgesContainer.innerHTML = badgesHTML
            }

            if (mostrarPainel) {
                if (adminPanel) adminPanel.style.display = 'block'
                if (viewerNotice) viewerNotice.style.display = 'none'

                if (btnLogs) {
                    if ((usuarioAtual.nivelAcesso === 2 || usuarioAtual.nivelAcesso === 3) && !isFiscalizacaoPura) {
                        btnLogs.style.display = 'inline-flex'
                        btnLogs.title = usuarioAtual.nivelAcesso === 3 ? 'Logs (Liderança)' : 'Logs (Ministério)'
                    } else {
                        btnLogs.style.display = 'none'
                    }
                }

                document.querySelectorAll('.col-acoes').forEach(col => {
                    col.style.display = podeExcluir ? 'table-cell' : 'none'
                })

            } else {
                if (adminPanel) adminPanel.style.display = 'none'
                if (viewerNotice) viewerNotice.style.display = 'flex'
                document.querySelectorAll('.col-acoes').forEach(col => col.style.display = 'none')
                if (btnLogs) btnLogs.style.display = 'none'
            }
        }

        async function carregarAdvertencias() {
            try {
                const { data, error } = await supabaseClient
                    .from('advertencias')
                    .select('*')
                    .eq('ativa', true)
                    .order('created_at', { ascending: false })

                if (error) {
                    console.error('Erro Supabase:', error)
                    showToast('Erro', 'Falha ao carregar dados do banco', 'error')
                    throw error
                }

                if (!data || data.length === 0) {
                    dados.observacoes = []
                    dados.advertencias = []
                    renderizarTabelas()
                    return
                }

                dados.observacoes = data.filter(d => d.tipo === 'observacao').map(d => ({
                    id: d.id,
                    nick: d.nick,
                    cargo: d.cargo,
                    infracao: d.infracao,
                    dataInicio: d.data_inicio,
                    dataFim: d.data_fim,
                    criado_por: d.criado_por,
                    cargo_criador: d.cargo_criador
                }))

                dados.advertencias = data.filter(d => d.tipo === 'advertencia').map(d => ({
                    id: d.id,
                    nick: d.nick,
                    cargo: d.cargo,
                    infracao: d.infracao,
                    dataInicio: d.data_inicio,
                    dataFim: d.data_fim,
                    criado_por: d.criado_por,
                    cargo_criador: d.cargo_criador
                }))

                renderizarTabelas()

            } catch (err) {
                console.error('Erro ao carregar:', err)
                showToast('Erro', 'Não foi possível carregar o quadro', 'error')
                dados.observacoes = []
                dados.advertencias = []
                renderizarTabelas()
            }
        }

        function toggleForm() {
            const form = document.getElementById('formContainer')
            if (!form) return

            form.classList.toggle('active')

            if (form.classList.contains('active')) {
                const hoje = new Date()
                const dataInicioInput = document.getElementById('dataInicioInput')
                if (dataInicioInput) dataInicioInput.valueAsDate = hoje

                atualizarPreviewFim()

                const nickInput = document.getElementById('nickInput')
                if (nickInput) nickInput.focus()
            }
        }

        function atualizarPreviewFim() {
            const dataInicio = document.getElementById('dataInicioInput')?.value
            const previewEl = document.getElementById('previewFim')

            if (!previewEl) return

            if (!dataInicio) {
                previewEl.innerHTML = '<i class="fa-solid fa-calendar-check"></i><span>Selecione a data de início</span>'
                return
            }

            const inicio = new Date(dataInicio)
            const fim = new Date(inicio)
            fim.setMonth(fim.getMonth() + 1)

            const dataFimFormatada = fim.toLocaleDateString('pt-BR')
            previewEl.innerHTML = `<i class="fa-solid fa-calendar-check"></i><span>Até <strong>${dataFimFormatada}</strong> (1 mês)</span>`
        }

        function calcularDataFim(dataInicioStr) {
            const inicio = new Date(dataInicioStr)
            const fim = new Date(inicio)
            fim.setMonth(fim.getMonth() + 1)
            return fim.toISOString().split('T')[0]
        }

        async function adicionarRegistro() {
            const tipo = document.getElementById('tipoRegistro')?.value;
            const nick = document.getElementById('nickInput')?.value.trim();
            const cargo = document.getElementById('cargoInput')?.value;
            const dataInicio = document.getElementById('dataInicioInput')?.value;
            const infracao = document.getElementById('infracaoInput')?.value.trim();
            const comprovacao = document.getElementById('comprovacaoInput')?.value.trim();

            if (!nick || !dataInicio || !infracao) {
                showToast('Erro', 'Preencha todos os campos obrigatórios', 'error');
                return;
            }

            if (!podeDeferirCargo(usuarioAtual.cargo, cargo)) {
                showToast('Erro', `Você não pode criar advertências para ${cargo}`, 'error');
                return;
            }

            const dataFim = calcularDataFim(dataInicio);

            showToast('Postando', 'Enviando postagem para o fórum...', 'success');
            try {
                await postarNoForumAutomatico(tipo, nick, infracao, comprovacao, dataInicio, dataFim);
                showToast('Sucesso', 'Postagem no fórum realizada!', 'success');
            } catch (err) {
                console.error('Erro ao postar no fórum:', err);
                showToast('Erro', 'Falha ao postar no fórum. Registro NÃO foi salvo.', 'error');
                return;
            }

            const deveEnviarMP = usuarioAtual.permissoes?.envia_mp !== false;
            if (deveEnviarMP) {
                showToast('Enviando', 'Enviando mensagem privada...', 'success');
                try {
                    if (tipo === 'observacao') {
                        await enviarMPObservacao(nick, infracao, comprovacao);
                    } else {
                        await enviarMPAdvertencia(nick, infracao, comprovacao);
                    }
                    showToast('Sucesso', 'Mensagem privada enviada!', 'success');
                } catch (err) {
                    console.error('Erro ao enviar MP:', err);
                    showToast('Aviso', 'Registro salvo, mas falha ao enviar MP', 'error');
                }
            }

            try {
                const { data, error } = await supabaseClient
                    .from('advertencias')
                    .insert([{
                        tipo: tipo,
                        nick: nick,
                        cargo: cargo,
                        infracao: infracao,
                        data_inicio: dataInicio,
                        data_fim: dataFim,
                        criado_por: usuarioAtual.nick,
                        cargo_criador: usuarioAtual.cargoSistema || usuarioAtual.cargo,
                        ativa: true
                    }])
                    .select();

                if (error) {
                    showToast('Erro', error.message, 'error');
                    return;
                }

                if (data && data[0]) {
                    await supabaseClient
                        .from('logs_advertencias')
                        .insert([{
                            acao: 'CREATE',
                            tipo_registro: tipo,
                            nick_afetado: nick,
                            realizado_por: usuarioAtual.nick,
                            cargo_autor: usuarioAtual.cargoSistema || usuarioAtual.cargo,
                            detalhes: {
                                infracao: infracao,
                                data_inicio: dataInicio,
                                data_fim: dataFim,
                                cargo_afetado: cargo,
                                id_registro: data[0].id,
                                comprovacao: comprovacao || null
                            }
                        }]);
                }

                document.getElementById('nickInput').value = '';
                document.getElementById('infracaoInput').value = '';
                document.getElementById('comprovacaoInput').value = '';

                toggleForm();
                await carregarAdvertencias();

                if (usuarioAtual.nivelAcesso >= 2 && usuarioAtual.nivelAcesso <= 3 && !usuarioAtual.permissoes?.is_fiscalizacao_pura) {
                    await carregarLogs();
                }

                showToast('Sucesso', `${tipo === 'observacao' ? 'Observação' : 'Advertência'} registrada!`, 'success');

            } catch (err) {
                console.error("Erro ao adicionar:", err);
                showToast('Erro', 'Falha ao salvar no banco de dados', 'error');
            }
        }

        async function postarNoForumAutomatico(tipo, nick, motivo, comprovacao, dataInicio, dataFim) {
            const idTopico = '31847'
            const tituloPost = (tipo === 'observacao' ? 'Observação' : 'Advertência Interna') + ' - ' + new Date().toLocaleDateString('pt-BR')

            const dataInicioFormatada = new Date(dataInicio).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }).replace('.', '')

            const dataFimFormatada = new Date(dataFim).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }).replace('.', '')

            let bbcode = ''
            if (tipo === 'observacao') {
                bbcode = `[table bgcolor="00529e" style="border-radius: 14px 14px 0px 0px; overflow: hidden; width: 35%; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);"][tr][td style="padding: 7px;"][color=#f8f8ff][size=18][b][font=Poppins][url=https://servimg.com/view/20530675/8][img]https://i.servimg.com/u/f76/20/53/06/75/3gw3ye10.png[/img][/url]
Observação[/font][/b][/size][/color][/td][/tr][/table][table bgcolor="#f8f8ff" style="border-radius: 0px 16px 16px 16px; overflow: hidden; width: 60%; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);"][tr][td][left][font=Poppins][size=13][b]Nickname:[/b] ${nick}
[b]Motivo(s):[/b] ${motivo}
[b]Período:[/b] ${dataInicioFormatada} a ${dataFimFormatada}
[/size][/font][/left][/td][/tr][/table]`
            } else {
                bbcode = `[table bgcolor="00529e" style="border-radius: 14px 14px 0px 0px; overflow: hidden; width: 35%; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);"][tr][td style="padding: 7px;"][color=#f8f8ff][size=18][b][font=Poppins][url=https://servimg.com/view/20530675/8][img]https://i.servimg.com/u/f76/20/53/06/75/3gw3ye10.png[/img][/url]
Advertência Interna[/font][/b][/size][/color][/td][/tr][/table][table bgcolor="#f8f8ff" style="border-radius: 0px 16px 16px 16px; overflow: hidden; width: 60%; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);"][tr][td][left][font=Poppins][size=13][b]Nickname:[/b] ${nick}
[b]Motivo(s):[/b] ${motivo}
[b]Período:[/b] ${dataInicioFormatada} a ${dataFimFormatada}
[/size][/font][/left][/td][/tr][/table]`
            }

            await postarNoForum(idTopico, tituloPost, bbcode)
        }

        function formatarData(dataStr) {
            const data = new Date(dataStr)
            return data.toLocaleDateString('pt-BR')
        }

        function renderizarTabelas() {
            renderizarTabela(dados.observacoes, 'tabelaObservacoes', 'observacao', 'countObs')
            renderizarTabela(dados.advertencias, 'tabelaAdvertencias', 'advertencia', 'countAdv')
        }

        function renderizarTabela(lista, elementoId, tipo, countId) {
            const countEl = document.getElementById(countId)
            const tbody = document.getElementById(elementoId)

            if (!tbody) return

            if (countEl) {
                countEl.textContent = `${lista.length} registro${lista.length !== 1 ? 's' : ''}`
            }

            const isFiscalizacaoPura = usuarioAtual.permissoes?.is_fiscalizacao_pura
            const podeExcluir = usuarioAtual.permissoes?.pode_excluir

            if (lista.length === 0) {
                tbody.innerHTML = `
            <tr>
                <td colspan="${podeExcluir ? 5 : 4}" class="empty-state">
                    <i class="fa-solid fa-clipboard-check"></i>
                    Nenhum registro encontrado
                </td>
            </tr>
        `
                return
            }

            tbody.innerHTML = lista.map(item => `
        <tr>
            <td>
                <div class="nick-cell">
                    <div class="avatar-mini">
                        <img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(item.nick)}&headonly=1&size=s" 
                             alt="${item.nick}" 
                             onerror="this.style.display='none'">
                    </div>
                    ${item.nick}
                </div>
            </td>
            <td>${item.cargo}</td>
            <td class="infracao-cell" title="${item.infracao}">${item.infracao}</td>
            <td>
                <div class="periodo-cell">
                    <div class="periodo-item periodo-inicio">
                        <div class="periodo-icon"><i class="fa-solid fa-play"></i></div>
                        <span class="periodo-label">Início</span>
                        <span class="periodo-data">${formatarData(item.dataInicio)}</span>
                    </div>
                    <div class="periodo-item periodo-fim">
                        <div class="periodo-icon"><i class="fa-solid fa-stop"></i></div>
                        <span class="periodo-label">Fim</span>
                        <span class="periodo-data">${formatarData(item.dataFim)}</span>
                    </div>
                </div>
            </td>
            ${podeExcluir ? `
                <td>
                    <div class="row-actions">
                        <button class="btn-icon delete" onclick="abrirModalExclusao('${item.id}', '${tipo}')" title="Remover registro">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            ` : (isFiscalizacaoPura ? '<td>-</td>' : '')}
        </tr>
    `).join('')
        }

        function abrirModalExclusao(id, tipo) {
            itemParaExcluir = id;
            tipoParaExcluir = tipo;

            const item = tipo === 'observacao'
                ? dados.observacoes.find(i => i.id === id)
                : dados.advertencias.find(i => i.id === id);

            if (!item) {
                console.error('Item não encontrado:', id, tipo);
                return;
            }

            const modalText = document.getElementById('modalText');
            const modalOverlay = document.getElementById('modalOverlay');

            if (modalText) {
                modalText.innerHTML = `
            Tem certeza que deseja remover o registro de <strong>${item.nick}</strong>?<br>
            <small style="color: var(--text-tertiary);">Tipo: ${tipo === 'observacao' ? 'Observação' : 'Advertência'}<br>Esta ação não pode ser desfeita.</small>
        `;
            }

            if (modalOverlay) modalOverlay.classList.add('active');
        }

        function fecharModal() {
            const modalOverlay = document.getElementById('modalOverlay')
            if (modalOverlay) modalOverlay.classList.remove('active')
            itemParaExcluir = null
            tipoParaExcluir = null
        }

        async function confirmarExclusao() {
            if (!itemParaExcluir || !tipoParaExcluir) {
                fecharModal();
                return;
            }

            const item = tipoParaExcluir === 'observacao'
                ? dados.observacoes.find(i => i.id === itemParaExcluir)
                : dados.advertencias.find(i => i.id === itemParaExcluir);

            if (!item) {
                fecharModal();
                return;
            }

            if (!usuarioAtual.permissoes?.pode_excluir) {
                showToast('Erro', 'Sem permissão para excluir registros', 'error');
                fecharModal();
                return;
            }

            if (!podeDeferirCargo(usuarioAtual.cargo, item.cargo)) {
                showToast('Erro', `Você não pode excluir registros de ${item.cargo}`, 'error');
                fecharModal();
                return;
            }

            try {
                showToast('Processando', 'Removendo registro...', 'success');

                await supabaseClient.rpc('set_user_context', {
                    p_nick: usuarioAtual.nick,
                    p_cargo: usuarioAtual.cargoSistema || usuarioAtual.cargo
                });

                const { error: deleteError } = await supabaseClient
                    .from('advertencias')
                    .delete()
                    .eq('id', itemParaExcluir);

                if (deleteError) {
                    console.error('Erro ao excluir:', deleteError);
                    showToast('Erro', deleteError.message || 'Erro ao excluir registro', 'error');
                    return;
                }

                fecharModal();
                await carregarAdvertencias();

                if (usuarioAtual.nivelAcesso >= 2 && usuarioAtual.nivelAcesso <= 3 && !usuarioAtual.permissoes?.is_fiscalizacao_pura) {
                    await carregarLogs();
                }

                showToast('Sucesso', 'Registro removido com sucesso!', 'success');

            } catch (err) {
                console.error("Erro ao excluir:", err);
                showToast('Erro', 'Falha ao excluir registro: ' + err.message, 'error');
            }
        }

        function toggleLogs() {
            const logsPanel = document.getElementById('logsPanel')
            if (!logsPanel) return

            logsPanel.classList.toggle('active')
            document.getElementById('formContainer')?.classList.remove('active')

            if (logsPanel.classList.contains('active')) {
                carregarLogs()
            }
        }

        async function carregarLogs() {
            if (usuarioAtual.nivelAcesso < 2 || usuarioAtual.nivelAcesso > 3 || usuarioAtual.permissoes?.is_fiscalizacao_pura) {
                console.log('Sem permissão para ver logs')
                return
            }

            try {
                const { data, error } = await supabaseClient
                    .from('logs_advertencias')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100)

                if (error) {
                    console.error('Erro ao carregar logs:', error)
                    return
                }

                logsSistema = data || []
                renderizarLogs()
                atualizarFiltroUsuarios()

            } catch (err) {
                console.error('Erro ao carregar logs:', err)
            }
        }

        function renderizarLogs(logs = logsSistema) {
            const container = document.getElementById('logsContainer')
            if (!container) return

            if (logs.length === 0) {
                container.innerHTML = `
            <div class="logs-empty">
                <i class="fa-solid fa-clipboard-list"></i>
                <p>Nenhum log encontrado</p>
            </div>
        `
                return
            }

            container.innerHTML = logs.map(log => {
                const data = new Date(log.created_at).toLocaleString('pt-BR')
                const icones = {
                    'CREATE': { icon: 'fa-plus', class: 'create' },
                    'DELETE': { icon: 'fa-trash', class: 'delete' },
                    'VIEW': { icon: 'fa-eye', class: 'view' }
                }
                const icone = icones[log.acao] || { icon: 'fa-info', class: 'view' }

                return `
            <div class="log-item">
                <div class="log-icon ${icone.class}">
                    <i class="fa-solid ${icone.icon}"></i>
                </div>
                <div class="log-content">
                    <div class="log-action">${log.acao} - ${log.tipo_registro === 'observacao' ? 'Observação' : 'Advertência'}</div>
                    <div class="log-details">${log.nick_afetado}${log.detalhes?.infracao ? ` - ${log.detalhes.infracao.substring(0, 50)}...` : ''}</div>
                </div>
                <div class="log-user">
                    <img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(log.realizado_por)}&headonly=1&size=s" 
                         onerror="this.style.display='none'">
                    ${log.realizado_por}
                </div>
                <div class="log-time">${data}</div>
            </div>
        `
            }).join('')
        }

        function filtrarLogs() {
            const tipo = document.getElementById('filtroLogTipo')?.value
            const usuario = document.getElementById('filtroLogUsuario')?.value

            let logsFiltrados = logsSistema

            if (tipo && tipo !== 'todos') {
                logsFiltrados = logsFiltrados.filter(l => l.acao === tipo)
            }

            if (usuario && usuario !== 'todos') {
                logsFiltrados = logsFiltrados.filter(l => l.realizado_por === usuario)
            }

            renderizarLogs(logsFiltrados)
        }

        function atualizarFiltroUsuarios() {
            const select = document.getElementById('filtroLogUsuario')
            if (!select) return

            const usuarios = [...new Set(logsSistema.map(l => l.realizado_por))]

            select.innerHTML = '<option value="todos">Todos usuários</option>' +
                usuarios.map(u => `<option value="${u}">${u}</option>`).join('')
        }

        function exportarLogs() {
            const csv = [
                ['Data', 'Ação', 'Tipo', 'Nick Afetado', 'Autor', 'Cargo', 'Detalhes'].join(','),
                ...logsSistema.map(l => [
                    new Date(l.created_at).toLocaleString('pt-BR'),
                    l.acao,
                    l.tipo_registro,
                    l.nick_afetado,
                    l.realizado_por,
                    l.cargo_autor,
                    `"${JSON.stringify(l.detalhes).replace(/"/g, '""')}"`
                ].join(','))
            ].join('\n')

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `logs_ins_${new Date().toISOString().split('T')[0]}.csv`
            link.click()
        }

        async function postarNoForum(idTopico, titulo, mensagem) {
            return new Promise((resolve, reject) => {
                function fazerPostagem() {
                    $.ajax({
                        url: '/post',
                        type: 'POST',
                        data: {
                            t: idTopico,
                            mode: 'reply',
                            subject: titulo,
                            message: mensagem,
                            post: 'Enviar'
                        },
                        success: function (response) {
                            resolve(response)
                        },
                        error: function (xhr, status, error) {
                            reject(new Error(`Erro na postagem: ${status}`))
                        }
                    })
                }

                if (typeof $ === 'undefined') {
                    const script = document.createElement('script')
                    script.src = 'https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js'
                    script.onload = () => fazerPostagem()
                    script.onerror = () => reject(new Error('Falha ao carregar jQuery'))
                    document.head.appendChild(script)
                } else {
                    fazerPostagem()
                }
            })
        }

        async function enviarMPObservacao(nick, motivo, comprova) {
            const bbcode = `[center][table bgcolor="00529e" style="border-radius: 23px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][img]https://i.imgur.com/n3Y0d1g.gif[/img]

[center][table bgcolor="#f8f8ff" style="border-radius: 16px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][font=Poppins][center][table bgcolor="00529e" style="border-radius: 14px 5px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][color=#f8f8ff][size=18][b]NOTIFICAÇÃO DE OBSERVAÇÃO[/b][/size][/color][/td][/tr][/table][/center]

Saudações, [b][color=#00529e]instrutor[/color] ${nick}[/b]!

Por meio desta Mensagem Privada, informa-se que você foi notificado internamente com uma observação na [b]Companhia dos [color=#00529e]Instrutores[/color][/b]. A seguir, são apresentadas as informações e provas acerca do ocorrido:

[center][table bgcolor="9fc6ea" style="border-radius: 14px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][b][left]DESCRIÇÃO: ${motivo}[/left][/b][b][left]PROVAS: ${comprova || 'N/A'}[/left][/b][/td][/tr][/table][/center]

Se houver insatisfação com a punição aplicada, é possível recorrer à Liderança da Companhia dos Instrutores, devendo apresentar argumentos e motivos bem fundamentados.

[center][table bgcolor="edf5fc" style="border-radius: 14px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][center][table bgcolor="00529e" style="border-radius: 14px 5px; overflow: hidden; width: 40%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td style="padding: 9px;"][color=#f8f8ff][b]ORIENTAÇÕES[/b][/color][/td][/tr][/table][/center]

[justify][color=#005dad]➥[/color] Lembre-se que, ao receber 2 (duas) notificações de observação no período de 30 (trinta) dias, receberá uma advertência interna após o registro da segunda notificação.

[color=#005dad]➥[/color] De forma a poder realizar corretamente as aplicações requeridas em seu posto, envie pedido no grupo de seu cargo no Habbo o quanto antes. Caso necessário, solicite a um ministro ou membro da liderança que aceite o pedido;

[color=#005dad]➥[/color] Caso necessário, lembre-se de reler o script de formação referente ao seu cargo, de modo a lembrar-se de eventuais detalhes e procedimentos a serem realizados;[/justify][/td][/tr][/table][/center][/td][/tr][/table][/center][/font]
[font=Poppins][size=12][color=#f8f8ff][b][img(10px,10px)]https://i.imgur.com/GoqL8ud.png[/img] Reservam-se os direitos à Companhia dos Instrutores[/b][/size][/color][/font][/td][/tr][/table][/center]`

            await enviarMP(nick, '[INS] Aviso de Observação', bbcode)
        }

        async function enviarMPAdvertencia(nick, motivo, comprova) {
            const bbcode = `[center][table bgcolor="00529e" style="border-radius: 23px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][img]https://i.imgur.com/n3Y0d1g.gif[/img]

[center][table bgcolor="#f8f8ff" style="border-radius: 16px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][font=Poppins][center][table bgcolor="00529e" style="border-radius: 14px 5px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][color=#f8f8ff][size=18][b]NOTIFICAÇÃO DE ADVERTÊNCIA INTERNA[/b][/size][/color][/td][/tr][/table][/center]

Saudações, [b][color=#00529e]instrutor[/color] ${nick}[/b]!

Por meio desta Mensagem Privada, informa-se que você foi advertido internamente na [b]Companhia dos [color=#00529e]Instrutores[/color][/b]. A seguir, são apresentadas as informações e provas acerca do ocorrido:

[center][table bgcolor="9fc6ea" style="border-radius: 14px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][b][left]DESCRIÇÃO: ${motivo}[/left][/b][b][left]PROVAS: ${comprova || 'N/A'}[/left][/b][/td][/tr][/table][/center]

Se houver insatisfação com a punição aplicada, é possível recorrer à Liderança da Companhia dos Instrutores, devendo apresentar argumentos e motivos bem fundamentados.

[center][table bgcolor="edf5fc" style="border-radius: 14px; overflow: hidden; width: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td][center][table bgcolor="00529e" style="border-radius: 14px 5px; overflow: hidden; width: 40%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"][tr][td style="padding: 9px;"][color=#f8f8ff][b]ORIENTAÇÕES[/b][/color][/td][/tr][/table][/center]

[justify][color=#005dad]➥[/color] Lembre-se que, ao ter 3 (três) advertências internas vigentes, receberá um rebaixamento após o registro da terceira advertência.

[color=#005dad]➥[/color] De forma a poder realizar corretamente as aplicações requeridas em seu posto, envie pedido no grupo de seu cargo no Habbo o quanto antes. Caso necessário, solicite a um ministro ou membro da liderança que aceite o pedido;

[color=#005dad]➥[/color] Caso necessário, lembre-se de ler o script de formação referente ao seu cargo, de modo a lembrar-se de eventuais detalhes e procedimentos a serem realizados;[/justify][/td][/tr][/table][/center][/td][/tr][/table][/center][/font]
[font=Poppins][size=12][color=#f8f8ff][b][img(10px,10px)]https://i.imgur.com/GoqL8ud.png[/img] Reservam-se os direitos à Companhia dos Instrutores[/b][/size][/color][/font][/td][/tr][/table][/center]`

            await enviarMP(nick, '[INS] Aviso de Advertência Interna', bbcode)
        }

        async function enviarMP(destinatario, assunto, mensagem) {
            return new Promise((resolve, reject) => {
                function fazerEnvio() {
                    $.ajax({
                        url: '/privmsg',
                        type: 'POST',
                        data: {
                            folder: 'inbox',
                            mode: 'post',
                            post: '1',
                            username: destinatario,
                            subject: assunto,
                            message: mensagem
                        },
                        success: function (response) {
                            resolve(response)
                        },
                        error: function (xhr, status, error) {
                            reject(new Error(`Erro ao enviar MP: ${status}`))
                        }
                    })
                }

                if (typeof $ === 'undefined') {
                    const script = document.createElement('script')
                    script.src = 'https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js'
                    script.onload = () => fazerEnvio()
                    script.onerror = () => reject(new Error('Falha ao carregar jQuery'))
                    document.head.appendChild(script)
                } else {
                    fazerEnvio()
                }
            })
        }

        function showToast(titulo, mensagem, tipo = 'success') {
            const toast = document.getElementById('toast')
            const toastTitle = document.getElementById('toastTitle')
            const toastMessage = document.getElementById('toastMessage')
            const toastIcon = toast?.querySelector('.toast-icon i')

            if (!toast || !toastTitle || !toastMessage) return

            toastTitle.textContent = titulo
            toastMessage.textContent = mensagem

            toast.className = `toast ${tipo} show`

            if (toastIcon) {
                toastIcon.className = tipo === 'success' ? 'fa-solid fa-check' :
                    tipo === 'error' ? 'fa-solid fa-xmark' : 'fa-solid fa-info'
            }

            setTimeout(() => {
                toast.classList.remove('show')
            }, 3000)
        }

        function toggleTema() {
            const html = document.documentElement
            const atual = html.getAttribute('data-theme')
            const novo = atual === 'dark' ? 'light' : 'dark'

            html.setAttribute('data-theme', novo)
            localStorage.setItem('tema', novo)

            const icon = document.querySelector('#themeToggle i')
            if (icon) {
                icon.className = novo === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            const temaSalvo = localStorage.getItem('tema')
            if (temaSalvo) {
                document.documentElement.setAttribute('data-theme', temaSalvo)
                const icon = document.querySelector('#themeToggle i')
                if (icon) {
                    icon.className = temaSalvo === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'
                }
            }

            inicializarSistema()
        })