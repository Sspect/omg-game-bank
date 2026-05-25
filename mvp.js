import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

    const supabaseUrl = 'https://pedtyonlklzbyikiywru.supabase.co'
    const supabaseKey = 'sb_publishable_oLffRxc_yv8J4ZDTuSSPXw_wQtNye15'

    const supabase = createClient(supabaseUrl, supabaseKey)

    async function loadGames() {
      const { data, error } = await supabase
        .from('Game')
        .select('*')

      if (error) {
        console.error('Error loading games:', error)
        return
      }

      const gamesList = document.getElementById('gamesList')
      gamesList.innerHTML = ''
      data.forEach(game => {
        const div = document.createElement('div')
        div.className = 'game-item'
        div.innerHTML = `<strong>${game.name}</strong><br>Players: ${game.min_players} - ${game.max_players}`
        gamesList.appendChild(div)
      })
    }

    async function addGame(e) {
      e.preventDefault()
      const name = document.getElementById('gameName').value
      const minPlayers = parseInt(document.getElementById('minPlayers').value)
      const maxPlayers = parseInt(document.getElementById('maxPlayers').value)

      if (!name || !minPlayers || !maxPlayers) {
        alert('Please fill in all fields')
        return
      }

      const { data, error } = await supabase
        .from('Game')
        .insert([
          {
            name: name,
            min_players: minPlayers,
            max_players: maxPlayers
          }
        ])

      if (error) {
        console.error('Error adding game:', error)
        alert('Error adding game')
      } else {
        document.getElementById('gameForm').reset()
        loadGames()
      }
    }

    document.getElementById('addGameBtn').addEventListener('click', addGame)
    loadGames()