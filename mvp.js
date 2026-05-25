import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

    const supabaseUrl = 'https://pedtyonlklzbyikiywru.supabase.co'
    const supabaseKey = 'sb_publishable_oLffRxc_yv8J4ZDTuSSPXw_wQtNye15'

    const supabase = createClient(supabaseUrl, supabaseKey)

    const datasetGames = [
      {
        name: 'Chess',
        min_players: 2,
        max_players: 2
      },
      {
        name: 'Catan',
        min_players: 3,
        max_players: 4
      },
      {
        name: 'Carcassonne',
        min_players: 2,
        max_players: 5
      },
      {
        name: 'Pandemic',
        min_players: 2,
        max_players: 4
      },
      {
        name: 'Codenames',
        min_players: 2,
        max_players: 8
      }
    ]

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

    async function resetToDataset() {
      const confirmed = window.confirm(
        'This will delete all games and replace them with the dataset. Continue?'
      )

      if (!confirmed) {
        return
      }

      const { error: deleteError } = await supabase
        .from('Game')
        .delete()
        .not('id', 'is', null)

      if (deleteError) {
        console.error('Error deleting games:', deleteError)
        alert('Error deleting games')
        return
      }

      const { error: insertError } = await supabase
        .from('Game')
        .insert(datasetGames)

      if (insertError) {
        console.error('Error inserting dataset:', insertError)
        alert('Error adding dataset')
        return
      }

      loadGames()
    }

    document.getElementById('addGameBtn').addEventListener('click', addGame)
    document.getElementById('datasetBtn').addEventListener('click', resetToDataset)
    loadGames()